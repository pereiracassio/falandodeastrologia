-- Avisos para o cliente (PDF e gravação disponíveis) e para o administrador (pedido novo, pagamento recebido, cliente baixou o arquivo),
-- todos gravados pelo próprio banco (sem Vercel). Rodar UMA vez no Supabase: SQL Editor -> New query -> colar tudo -> Run.

-- aviso para quem é cliente: fica guardado sempre (não entra no limite de 10 mais novos)
create or replace function public.criar_aviso_cliente(p_email text, p_titulo text, p_corpo text, p_url text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(trim(p_email), '') = '' then return; end if;
  if exists (
    select 1 from public.avisos_recebidos
    where lower(email) = lower(p_email) and titulo = p_titulo and url = p_url and corpo = p_corpo and criado_em > now() - interval '2 minutes'
  ) then return; end if;
  insert into public.avisos_recebidos (email, titulo, corpo, url, guardar_sempre)
  values (lower(p_email), p_titulo, p_corpo, p_url, true);
end $$;
revoke all on function public.criar_aviso_cliente(text, text, text, text) from public;

-- avisa todos os administradores
create or replace function public.avisar_admins(p_titulo text, p_corpo text, p_url text)
returns void language plpgsql security definer set search_path = public as $$
declare adm record;
begin
  for adm in select email from public.admins where coalesce(email, '') <> '' loop
    perform public.criar_aviso(adm.email, p_titulo, p_corpo, p_url, null);
  end loop;
end $$;
revoke all on function public.avisar_admins(text, text, text) from public;

-- PDF ou gravação disponibilizados para o cliente (entrega nova, ou link novo/trocado)
create or replace function public.trg_aviso_entrega() returns trigger
language plpgsql security definer set search_path = public as $$
declare cli record; primeiro text; url text;
begin
  select id, nome, email into cli from public.clientes where id = new.cliente_id;
  if cli.id is null then return new; end if;
  primeiro := coalesce(nullif(split_part(trim(coalesce(cli.nome, '')), ' ', 1), ''), 'cliente');
  url := '/cliente.html?aviso=1&e=' || new.id;
  if new.gravacao_link is not null and (tg_op = 'INSERT' or new.gravacao_link is distinct from old.gravacao_link) then
    perform public.criar_aviso_cliente(cli.email, 'Gravação disponível', 'Oi, ' || primeiro || '! Já disponibilizei a gravação do seu atendimento: ' || left(coalesce(new.servico, ''), 120), url);
  end if;
  if new.pdf_link is not null and (tg_op = 'INSERT' or new.pdf_link is distinct from old.pdf_link) then
    perform public.criar_aviso_cliente(cli.email, 'Material disponível', 'Oi, ' || primeiro || '! Disponibilizei o material complementar do seu serviço: ' || left(coalesce(new.servico, ''), 120), url);
  end if;
  return new;
end $$;
drop trigger if exists aviso_entrega on public.entregas;
create trigger aviso_entrega after insert or update of pdf_link, gravacao_link on public.entregas
  for each row execute function public.trg_aviso_entrega();

-- o cliente tocou em baixar: avisa o administrador
create or replace function public.trg_aviso_baixa() returns trigger
language plpgsql security definer set search_path = public as $$
declare ent record; cli record;
begin
  select id, cliente_id, servico into ent from public.entregas where id = new.entrega_id;
  if ent.id is null then return new; end if;
  select id, nome into cli from public.clientes where id = ent.cliente_id;
  perform public.avisar_admins('Arquivo baixado', coalesce(nullif(trim(cli.nome), ''), 'O cliente') || ' baixou ' || (case when new.tipo = 'pdf' then 'o PDF' else 'a gravação' end) || ': ' || left(coalesce(ent.servico, ''), 120), '/admin-clientes.html?cliente=' || cli.id);
  return new;
end $$;
drop trigger if exists aviso_baixa on public.entrega_baixas;
create trigger aviso_baixa after insert on public.entrega_baixas
  for each row execute function public.trg_aviso_baixa();

-- pedido novo feito no carrinho do site: avisa o administrador
create or replace function public.trg_aviso_pedido() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.avisar_admins('Pedido novo', coalesce(nullif(trim(new.nome), ''), 'Alguém') || ' fez um pedido: ' || left(coalesce(new.servicos, ''), 160), '/admin-checkouts.html');
  return new;
end $$;
drop trigger if exists aviso_pedido on public.pedidos;
create trigger aviso_pedido after insert on public.pedidos
  for each row execute function public.trg_aviso_pedido();

-- pagamento confirmado pelo InfinitePay (entra no Financeiro sozinho): avisa o administrador
create or replace function public.trg_aviso_pagamento_recebido() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.origem is distinct from 'infinitepay' then return new; end if;
  perform public.avisar_admins('Pagamento recebido', left(coalesce(new.produto, 'Pagamento'), 120) || ': R$ ' || replace(to_char(coalesce(new.valor, 0), 'FM999999990.00'), '.', ','), '/admin-financeiro.html');
  return new;
end $$;
drop trigger if exists aviso_pagamento_recebido on public.fin_entradas;
create trigger aviso_pagamento_recebido after insert on public.fin_entradas
  for each row execute function public.trg_aviso_pagamento_recebido();
