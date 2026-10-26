-- Leitor de PDF (aba Leitor do painel): livros do Drive, página onde parou e marcações. Só o administrador.
create table public.leitor_livros (
  id uuid primary key default gen_random_uuid(),
  drive_id text not null unique,
  nome text not null,
  pagina int not null default 1,
  total int,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create table public.leitor_tracos (
  livro_id uuid not null references public.leitor_livros(id) on delete cascade,
  pagina int not null,
  tracos jsonb not null default '[]',
  atualizado_em timestamptz not null default now(),
  primary key (livro_id, pagina)
);
alter table public.leitor_livros enable row level security;
alter table public.leitor_tracos enable row level security;
create policy "admin leitor_livros" on public.leitor_livros for all to authenticated using (public.sou_admin()) with check (public.sou_admin());
create policy "admin leitor_tracos" on public.leitor_tracos for all to authenticated using (public.sou_admin()) with check (public.sou_admin());
grant select, insert, update, delete on public.leitor_livros, public.leitor_tracos to authenticated;
