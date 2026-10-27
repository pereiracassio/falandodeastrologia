-- Curso "Fundamentos da Astrologia Natal": cursos, módulos, aulas e matrículas (quem pode ver o quê).
create table public.cursos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  criado_em timestamptz not null default now()
);
create table public.curso_modulos (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references public.cursos(id) on delete cascade,
  ordem int not null,
  titulo text not null,
  apostila_drive_id text,
  apostila_nome text,
  criado_em timestamptz not null default now()
);
create table public.curso_aulas (
  id uuid primary key default gen_random_uuid(),
  modulo_id uuid not null references public.curso_modulos(id) on delete cascade,
  ordem int not null,
  titulo text not null,
  video_origem text not null default 'youtube' check (video_origem in ('youtube', 'drive')),
  video_codigo text,
  video_teste boolean not null default true,
  criado_em timestamptz not null default now()
);
create table public.curso_matriculas (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references public.cursos(id) on delete cascade,
  email text not null,
  nome text,
  modulo_liberado int not null default 1,
  criado_em timestamptz not null default now()
);
create unique index curso_matriculas_unica on public.curso_matriculas (curso_id, lower(email));

alter table public.cursos enable row level security;
alter table public.curso_modulos enable row level security;
alter table public.curso_aulas enable row level security;
alter table public.curso_matriculas enable row level security;

create policy "admin cursos" on public.cursos for all to authenticated using (public.sou_admin()) with check (public.sou_admin());
create policy "admin curso_modulos" on public.curso_modulos for all to authenticated using (public.sou_admin()) with check (public.sou_admin());
create policy "admin curso_aulas" on public.curso_aulas for all to authenticated using (public.sou_admin()) with check (public.sou_admin());
create policy "admin curso_matriculas" on public.curso_matriculas for all to authenticated using (public.sou_admin()) with check (public.sou_admin());

-- o aluno matriculado vê o curso e os módulos (os trancados aparecem só com o título) e só as aulas dos módulos já liberados
create policy "aluno le a propria matricula" on public.curso_matriculas for select to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
create policy "aluno le o curso" on public.cursos for select to authenticated
  using (exists (select 1 from public.curso_matriculas m where m.curso_id = cursos.id and lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))));
create policy "aluno le os modulos" on public.curso_modulos for select to authenticated
  using (exists (select 1 from public.curso_matriculas m where m.curso_id = curso_modulos.curso_id and lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))));
create policy "aluno le as aulas liberadas" on public.curso_aulas for select to authenticated
  using (exists (select 1 from public.curso_modulos mo join public.curso_matriculas m on m.curso_id = mo.curso_id
    where mo.id = curso_aulas.modulo_id and mo.ordem <= m.modulo_liberado and lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))));

grant select, insert, update, delete on public.cursos, public.curso_modulos, public.curso_aulas, public.curso_matriculas to authenticated;
grant all on public.cursos, public.curso_modulos, public.curso_aulas, public.curso_matriculas to service_role;
