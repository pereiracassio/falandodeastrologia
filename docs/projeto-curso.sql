-- Projeto de curso (aba Cursos dentro dos Projetos): curso -> módulos -> aulas, com etapas ticadas. Rodar UMA vez; idempotente.
create table if not exists public.pc_cursos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  data_inicio date,
  data_fim date,
  etapas jsonb not null default '["gravacao","edicao_grossa","edicao_fina","capa","upload"]'::jsonb,
  criado_em timestamptz not null default now()
);
create table if not exists public.pc_modulos (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references public.pc_cursos(id) on delete cascade,
  nome text not null,
  ordem int not null default 0,
  apostila_ok boolean not null default false,
  apostila_em timestamptz,
  criado_em timestamptz not null default now()
);
create table if not exists public.pc_aulas (
  id uuid primary key default gen_random_uuid(),
  modulo_id uuid not null references public.pc_modulos(id) on delete cascade,
  numero int not null default 1,
  titulo text,
  gravacao boolean not null default false,
  edicao_grossa boolean not null default false,
  edicao_fina boolean not null default false,
  capa boolean not null default false,
  upload boolean not null default false,
  criado_em timestamptz not null default now()
);
create table if not exists public.pc_passos (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references public.pc_cursos(id) on delete cascade,
  modulo_id uuid references public.pc_modulos(id) on delete cascade,
  fase text not null default 'ideia' check (fase in ('ideia','modulo','final')),
  titulo text not null,
  nota text,
  feito boolean not null default false,
  feito_em timestamptz,
  ordem int not null default 0,
  data date,
  criado_em timestamptz not null default now()
);
-- (01/11) texto da ideia do curso
alter table public.pc_cursos add column if not exists ideia text;

create index if not exists pc_modulos_curso_idx on public.pc_modulos (curso_id);
create index if not exists pc_aulas_modulo_idx on public.pc_aulas (modulo_id);
create index if not exists pc_passos_curso_idx on public.pc_passos (curso_id);

alter table public.pc_cursos enable row level security;
alter table public.pc_modulos enable row level security;
alter table public.pc_aulas enable row level security;
alter table public.pc_passos enable row level security;
drop policy if exists pc_cursos_admin on public.pc_cursos;
drop policy if exists pc_modulos_admin on public.pc_modulos;
drop policy if exists pc_aulas_admin on public.pc_aulas;
drop policy if exists pc_passos_admin on public.pc_passos;
create policy pc_cursos_admin on public.pc_cursos for all to authenticated using (public.sou_admin()) with check (public.sou_admin());
create policy pc_modulos_admin on public.pc_modulos for all to authenticated using (public.sou_admin()) with check (public.sou_admin());
create policy pc_aulas_admin on public.pc_aulas for all to authenticated using (public.sou_admin()) with check (public.sou_admin());
create policy pc_passos_admin on public.pc_passos for all to authenticated using (public.sou_admin()) with check (public.sou_admin());
grant select, insert, update, delete on public.pc_cursos, public.pc_modulos, public.pc_aulas, public.pc_passos to authenticated;
grant all on public.pc_cursos, public.pc_modulos, public.pc_aulas, public.pc_passos to service_role;
