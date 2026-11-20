create table if not exists public.aluno_roteiro (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.alunos(id) on delete cascade,
  data date not null,
  itens jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now()
);
create index if not exists aluno_roteiro_aluno_idx on public.aluno_roteiro (aluno_id, data);
alter table public.aluno_roteiro enable row level security;
drop policy if exists "admin roteiro" on public.aluno_roteiro;
create policy "admin roteiro" on public.aluno_roteiro for all to authenticated using (public.sou_admin()) with check (public.sou_admin());
grant select, insert, update, delete on public.aluno_roteiro to authenticated;
grant all on public.aluno_roteiro to service_role;
