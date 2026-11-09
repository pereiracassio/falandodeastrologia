alter table public.curso_aulas add column if not exists tipo text not null default 'gravada';
alter table public.curso_aulas add column if not exists data_hora timestamptz;
alter table public.curso_aulas add column if not exists link_meet text;
