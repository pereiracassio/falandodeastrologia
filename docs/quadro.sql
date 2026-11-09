-- Quadro (admin-quadro.html): a folha onde o administrador coloca imagens, textos e riscos para usar em lives.
-- Rodar UMA vez no Supabase do Falando de Astrologia. Pode rodar de novo sem problema.
create table if not exists public.quadros (
  id text primary key,
  dados jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now()
);
alter table public.quadros enable row level security;
drop policy if exists "admin quadros" on public.quadros;
create policy "admin quadros" on public.quadros for all to authenticated using (public.sou_admin()) with check (public.sou_admin());
grant select, insert, update, delete on public.quadros to authenticated;
grant all on public.quadros to service_role;
