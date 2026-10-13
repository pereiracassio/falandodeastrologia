-- Portal do Aluno (Falando de Astrologia) — rodar UMA vez no Supabase: SQL Editor -> New query -> colar tudo -> Run.
-- Antes de rodar, troque SEU_EMAIL_AQUI (última linha) pelo e-mail do administrador.

create table public.admins (
  email text primary key
);

create table public.alunos (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  nome text not null,
  criado_em timestamptz not null default now()
);

create table public.itens (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.alunos(id) on delete cascade,
  bloco text not null check (bloco in ('gravacoes', 'materiais', 'caderno')),
  titulo text not null,
  link text not null,
  data date,
  criado_em timestamptz not null default now()
);

alter table public.admins enable row level security;
alter table public.alunos enable row level security;
alter table public.itens enable row level security;

-- "sou administrador?" — lê a tabela admins sem expô-la a ninguém
create or replace function public.sou_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.admins where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

revoke all on function public.sou_admin() from public, anon;
grant execute on function public.sou_admin() to authenticated;

grant select, insert, update, delete on public.alunos, public.itens to authenticated;

-- Aluno vê só a própria ficha e os próprios itens; a administrador vê e mexe em tudo.
create policy alunos_ler on public.alunos for select to authenticated
  using (public.sou_admin() or lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
create policy alunos_admin_inserir on public.alunos for insert to authenticated
  with check (public.sou_admin());
create policy alunos_admin_editar on public.alunos for update to authenticated
  using (public.sou_admin()) with check (public.sou_admin());
create policy alunos_admin_apagar on public.alunos for delete to authenticated
  using (public.sou_admin());

create policy itens_ler on public.itens for select to authenticated
  using (
    public.sou_admin()
    or exists (
      select 1 from public.alunos a
      where a.id = itens.aluno_id and lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );
create policy itens_admin_inserir on public.itens for insert to authenticated
  with check (public.sou_admin());
create policy itens_admin_editar on public.itens for update to authenticated
  using (public.sou_admin()) with check (public.sou_admin());
create policy itens_admin_apagar on public.itens for delete to authenticated
  using (public.sou_admin());

insert into public.admins (email) values (lower('SEU_EMAIL_AQUI'));

-- (12/10) Nome do administrador na saudação: coluna nome + cada administrador lê só a própria linha.
alter table public.admins add column if not exists nome text;
grant select on public.admins to authenticated;
create policy admins_ler_propria on public.admins for select to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
update public.admins set nome = 'Cássio' where email = 'cassio15pereira@gmail.com';

-- (13/10) Descrição opcional de cada item.
alter table public.itens add column if not exists descricao text;

-- (13/10) Link fixo do Google Meet de cada aluno.
alter table public.alunos add column if not exists meet_link text;
