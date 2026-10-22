-- Já rodado pelo administrador (22/10/2026): registra quando o aluno abre um material ou gravação.
create table public.item_aberturas (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.itens(id) on delete cascade,
  aluno_id uuid not null references public.alunos(id) on delete cascade,
  criado_em timestamptz not null default now()
);
alter table public.item_aberturas enable row level security;
grant select, insert on public.item_aberturas to authenticated;
grant all on public.item_aberturas to service_role;
create policy aberturas_inserir on public.item_aberturas for insert to authenticated
  with check (exists (select 1 from public.itens i join public.alunos a on a.id = i.aluno_id
    where i.id = item_aberturas.item_id and a.id = item_aberturas.aluno_id
      and lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))));
create policy aberturas_ler on public.item_aberturas for select to authenticated using (public.sou_admin());
