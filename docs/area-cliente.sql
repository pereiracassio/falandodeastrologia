-- Área do Cliente (Falando de Astrologia) — rodar UMA vez no Supabase: SQL Editor -> New query -> colar tudo -> Run.
-- Usa a função public.sou_admin() que já existe (docs/portal-aluno.sql).

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  nome text not null,
  criado_em timestamptz not null default now()
);

create table public.entregas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  servico text not null,
  data date,
  pdf_link text,
  gravacao_link text,
  criado_em timestamptz not null default now()
);

alter table public.clientes enable row level security;
alter table public.entregas enable row level security;

grant select, insert, update, delete on public.clientes, public.entregas to authenticated;

-- O cliente vê só a própria ficha e as próprias entregas; o administrador vê e mexe em tudo.
create policy clientes_ler on public.clientes for select to authenticated
  using (public.sou_admin() or lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
create policy clientes_admin_inserir on public.clientes for insert to authenticated
  with check (public.sou_admin());
create policy clientes_admin_editar on public.clientes for update to authenticated
  using (public.sou_admin()) with check (public.sou_admin());
create policy clientes_admin_apagar on public.clientes for delete to authenticated
  using (public.sou_admin());

create policy entregas_ler on public.entregas for select to authenticated
  using (
    public.sou_admin()
    or exists (
      select 1 from public.clientes c
      where c.id = entregas.cliente_id and lower(c.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );
create policy entregas_admin_inserir on public.entregas for insert to authenticated
  with check (public.sou_admin());
create policy entregas_admin_editar on public.entregas for update to authenticated
  using (public.sou_admin()) with check (public.sou_admin());
create policy entregas_admin_apagar on public.entregas for delete to authenticated
  using (public.sou_admin());

-- (13/10) Código do cliente (o mesmo do Astro Hellenic). Fica numa tabela SÓ do administrador:
-- sem policy pra quem não é admin, então o cliente não consegue ler o código nem pela API.
create table public.cliente_codigos (
  cliente_id uuid primary key references public.clientes(id) on delete cascade,
  codigo text not null unique
);
alter table public.cliente_codigos enable row level security;
grant select, insert, update, delete on public.cliente_codigos to authenticated;
create policy codigos_so_admin on public.cliente_codigos for all to authenticated
  using (public.sou_admin()) with check (public.sou_admin());
