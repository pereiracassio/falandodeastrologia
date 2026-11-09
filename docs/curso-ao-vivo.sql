alter table public.curso_aulas add column if not exists tipo text not null default 'gravada';
alter table public.curso_aulas add column if not exists data_hora timestamptz;
alter table public.curso_aulas add column if not exists link_meet text;
alter table public.curso_aulas add column if not exists datas_etapas jsonb not null default '{}'::jsonb;
alter table public.curso_modulos add column if not exists data_apostila date;
