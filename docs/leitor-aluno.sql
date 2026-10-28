-- Marcações e página do leitor de PDF para aluno e cliente: cada pessoa vê e mexe só no que é dela.
create table public.leitor_marcacoes (
  user_id uuid not null default auth.uid(),
  drive_id text not null,
  pagina int not null,
  tracos jsonb not null default '[]',
  atualizado_em timestamptz not null default now(),
  primary key (user_id, drive_id, pagina)
);
create table public.leitor_posicao (
  user_id uuid not null default auth.uid(),
  drive_id text not null,
  pagina int not null default 1,
  atualizado_em timestamptz not null default now(),
  primary key (user_id, drive_id)
);
alter table public.leitor_marcacoes enable row level security;
alter table public.leitor_posicao enable row level security;
create policy "dono leitor_marcacoes" on public.leitor_marcacoes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "dono leitor_posicao" on public.leitor_posicao for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.leitor_marcacoes, public.leitor_posicao to authenticated;
