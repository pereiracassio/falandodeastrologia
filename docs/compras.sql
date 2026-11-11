-- Lista de compras (admin-compras.html), aba do Hellenic Daily.
-- Rodar UMA vez no Supabase do Falando de Astrologia. Pode rodar de novo sem problema.
create table if not exists public.compras_itens (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  estado text not null default 'lista' check (estado in ('lista','carrinho','comprado')),
  criado_em timestamptz not null default now(),
  comprado_em timestamptz
);
alter table public.compras_itens enable row level security;
drop policy if exists "admin compras" on public.compras_itens;
create policy "admin compras" on public.compras_itens for all to authenticated using (public.sou_admin()) with check (public.sou_admin());
grant select, insert, update, delete on public.compras_itens to authenticated;
grant all on public.compras_itens to service_role;
