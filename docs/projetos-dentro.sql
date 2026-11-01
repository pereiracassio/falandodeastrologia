-- Projetos dentro de projetos (rodado pelo astrólogo no SQL Editor; idempotente)
do $$
declare t text;
begin
  select format_type(a.atttypid, a.atttypmod) into t
    from pg_attribute a where a.attrelid = 'public.projetos'::regclass and a.attname = 'id';
  execute format('alter table public.projetos add column if not exists projeto_pai_id %s references public.projetos(id) on delete set null', t);
end $$;

alter table public.projetos add column if not exists ordem_no_pai integer;
create index if not exists projetos_pai_idx on public.projetos (projeto_pai_id);

create or replace function public.projetos_sem_ciclo() returns trigger
language plpgsql as $$
declare atual public.projetos.id%type;
begin
  if new.projeto_pai_id is null then return new; end if;
  if new.projeto_pai_id = new.id then
    raise exception 'Um projeto não pode ficar dentro dele mesmo.';
  end if;
  atual := new.projeto_pai_id;
  while atual is not null loop
    if atual = new.id then
      raise exception 'Esse projeto está dentro do que você escolheu.';
    end if;
    select projeto_pai_id into atual from public.projetos where id = atual;
  end loop;
  return new;
end $$;

drop trigger if exists projetos_sem_ciclo on public.projetos;
create trigger projetos_sem_ciclo
  before insert or update of projeto_pai_id on public.projetos
  for each row execute function public.projetos_sem_ciclo();
