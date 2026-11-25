-- Aviso ao administrador quando o pagamento do carrinho não abre para o cliente.
create table if not exists public.pagamento_falhas (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  order_nsu text, nome text, whatsapp text, email text, servicos text, motivo text
);
alter table public.pagamento_falhas enable row level security;
drop policy if exists "visitante registra falha" on public.pagamento_falhas;
create policy "visitante registra falha" on public.pagamento_falhas for insert to anon, authenticated
  with check (length(coalesce(nome,'')) <= 200 and length(coalesce(servicos,'')) <= 600 and length(coalesce(motivo,'')) <= 400);
drop policy if exists "admin le falhas" on public.pagamento_falhas;
create policy "admin le falhas" on public.pagamento_falhas for select to authenticated using (public.sou_admin());
grant insert on public.pagamento_falhas to anon, authenticated;
grant select on public.pagamento_falhas to authenticated;
grant all on public.pagamento_falhas to service_role;

create or replace function public.trg_aviso_pagamento_falhou() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.avisar_admins('Pagamento não abriu',
    coalesce(nullif(trim(new.nome), ''), 'Um cliente') || ' não conseguiu abrir o pagamento (' || left(coalesce(new.servicos, ''), 100) || '). WhatsApp: ' || coalesce(new.whatsapp, '-') || '. Motivo: ' || left(coalesce(new.motivo, '-'), 120),
    '/admin-checkouts.html');
  return new;
end $$;
drop trigger if exists aviso_pagamento_falhou on public.pagamento_falhas;
create trigger aviso_pagamento_falhou after insert on public.pagamento_falhas
  for each row execute function public.trg_aviso_pagamento_falhou();

-- Para onde cada aviso de compra abre: o CLIENTE (nunca a aba Checkouts, que é só para copiar link).
create or replace function public.trg_aviso_pedido() returns trigger
language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  select id into cid from public.clientes where lower(email) = lower(coalesce(new.email, '')) limit 1;
  perform public.avisar_admins('Pedido novo', coalesce(nullif(trim(new.nome), ''), 'Alguém') || ' fez um pedido: ' || left(coalesce(new.servicos, ''), 160),
    case when cid is not null then '/admin-clientes.html?cliente=' || cid else '/admin-clientes.html' end);
  return new;
end $$;

create or replace function public.trg_aviso_pagamento_recebido() returns trigger
language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if new.origem is distinct from 'infinitepay' then return new; end if;
  select cliente_id into cid from public.pedidos
    where cliente_id is not null and pago_em > now() - interval '5 minutes'
      and coalesce(new.cliente_nome, '') like '%' || nome
    order by pago_em desc limit 1;
  perform public.avisar_admins('Pagamento recebido', left(coalesce(new.produto, 'Pagamento'), 120) || ': R$ ' || replace(to_char(coalesce(new.valor, 0), 'FM999999990.00'), '.', ','),
    case when cid is not null then '/admin-clientes.html?cliente=' || cid else '/admin-financeiro.html' end);
  return new;
end $$;
