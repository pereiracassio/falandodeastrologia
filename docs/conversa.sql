-- Mensagens do aluno para o Cássio (e as respostas), na aba Dúvidas do app — rodar UMA vez no Supabase: SQL Editor -> New query -> colar tudo -> Run.
-- O aluno só vê a própria conversa; o administrador vê todas. Só texto. Os avisos (para o Cássio e para o aluno) são gravados pelo próprio banco.

create table if not exists public.aluno_mensagens (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.alunos(id) on delete cascade,
  de text not null check (de in ('aluno', 'cassio')),
  texto text not null check (length(trim(texto)) > 0 and length(texto) <= 2000),
  criado_em timestamptz not null default now(),
  lida_em timestamptz
);
create index if not exists aluno_mensagens_aluno_idx on public.aluno_mensagens (aluno_id, criado_em);
alter table public.aluno_mensagens enable row level security;
grant select, insert on public.aluno_mensagens to authenticated;
grant all on public.aluno_mensagens to service_role;

create or replace function public.aluno_e_meu(p_aluno uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.alunos where id = p_aluno and lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
revoke all on function public.aluno_e_meu(uuid) from public;
grant execute on function public.aluno_e_meu(uuid) to authenticated;

drop policy if exists mensagens_ler on public.aluno_mensagens;
create policy mensagens_ler on public.aluno_mensagens for select to authenticated
  using (public.sou_admin() or public.aluno_e_meu(aluno_id));
drop policy if exists mensagens_escrever on public.aluno_mensagens;
create policy mensagens_escrever on public.aluno_mensagens for insert to authenticated
  with check ((public.sou_admin() and de = 'cassio') or (public.aluno_e_meu(aluno_id) and de = 'aluno'));

-- marcar como lidas: o aluno marca as mensagens do Cássio; o Cássio marca as do aluno
create or replace function public.marcar_conversa_lida(p_aluno uuid) returns void
language plpgsql security definer set search_path = public as $$
declare mail text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if public.sou_admin() then
    update public.aluno_mensagens set lida_em = now() where aluno_id = p_aluno and de = 'aluno' and lida_em is null;
    update public.avisos_recebidos set lido = true where lido = false and lower(email) = mail and url like '%aba=conversa%' and url like '%aluno=' || p_aluno::text || '%';
  elsif public.aluno_e_meu(p_aluno) then
    update public.aluno_mensagens set lida_em = now() where aluno_id = p_aluno and de = 'cassio' and lida_em is null;
    update public.avisos_recebidos set lido = true where lido = false and lower(email) = mail and url like '%aba=conversa%';
  end if;
end $$;
revoke all on function public.marcar_conversa_lida(uuid) from public;
grant execute on function public.marcar_conversa_lida(uuid) to authenticated;

-- aviso de mensagem: o corpo é SÓ a mensagem (nada de "Oi, fulano, respondi..."); o título é quem mandou (o nome do aluno para o Cássio; Cássio para o aluno)
create or replace function public.criar_aviso_conversa_admins(p_titulo text, p_corpo text, p_url text) returns void
language plpgsql security definer set search_path = public as $$
declare adm record;
begin
  for adm in select email from public.admins where coalesce(email, '') <> '' loop
    perform public.criar_aviso(adm.email, p_titulo, p_corpo, p_url, null);
  end loop;
end $$;
revoke all on function public.criar_aviso_conversa_admins(text, text, text) from public;

create or replace function public.trg_aviso_mensagem() returns trigger
language plpgsql security definer set search_path = public as $$
declare alu record; primeiro text;
begin
  select id, nome, email into alu from public.alunos where id = new.aluno_id;
  if alu.id is null then return new; end if;
  primeiro := coalesce(nullif(split_part(trim(coalesce(alu.nome, '')), ' ', 1), ''), 'aluno');
  if new.de = 'aluno' then
    perform public.criar_aviso_conversa_admins(primeiro, left(new.texto, 140), '/admin-alunos.html#aluno=' || alu.id || '&aba=conversa');
  else
    perform public.criar_aviso(alu.email, 'Cássio', left(new.texto, 140), '/aluno.html?aba=conversa', null);
  end if;
  return new;
end $$;
drop trigger if exists aviso_mensagem on public.aluno_mensagens;
create trigger aviso_mensagem after insert on public.aluno_mensagens
  for each row execute function public.trg_aviso_mensagem();

-- a mensagem aparece na hora na tela de quem está com a conversa aberta
do $$ begin
  alter publication supabase_realtime add table public.aluno_mensagens;
exception when duplicate_object then null;
end $$;
