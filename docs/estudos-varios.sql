-- Estudos: vários estudos (cada um com início, data final opcional e "encerrado"). Rodar UMA vez no Supabase.
create table public.estudos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  data_inicio date not null default current_date,
  data_fim date,
  encerrado boolean not null default false,
  encerrado_em date,
  criado_em timestamptz not null default now()
);
alter table public.estudos enable row level security;
grant select, insert, update, delete on public.estudos to authenticated;
create policy "admin estudos" on public.estudos for all to authenticated using (public.sou_admin()) with check (public.sou_admin());

alter table public.estudo_aulas add column if not exists estudo_id uuid references public.estudos(id) on delete cascade;

-- o estudo que já existe: Vestibular Fatec, de 26/10 a 13/12/2026
insert into public.estudos (nome, data_inicio, data_fim) values ('Vestibular Fatec', '2026-10-26', '2026-12-13');
update public.estudo_aulas set estudo_id = (select id from public.estudos where nome = 'Vestibular Fatec') where estudo_id is null;
