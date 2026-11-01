-- Estudos dentro de estudos + "dividir por semanas" opcional (rodar UMA vez no Supabase; idempotente)
do $$
declare t text;
begin
  select format_type(a.atttypid, a.atttypmod) into t
    from pg_attribute a where a.attrelid = 'public.estudos'::regclass and a.attname = 'id';
  execute format('alter table public.estudos add column if not exists estudo_pai_id %s references public.estudos(id) on delete set null', t);
end $$;

-- os estudos que já existem continuam por semana (o Vestibular Fatec); os novos nascem sem
alter table public.estudos add column if not exists por_semana boolean not null default true;
create index if not exists estudos_pai_idx on public.estudos (estudo_pai_id);

create or replace function public.estudos_sem_ciclo() returns trigger
language plpgsql as $$
declare atual public.estudos.id%type;
begin
  if new.estudo_pai_id is null then return new; end if;
  if new.estudo_pai_id = new.id then
    raise exception 'Um estudo não pode ficar dentro dele mesmo.';
  end if;
  atual := new.estudo_pai_id;
  while atual is not null loop
    if atual = new.id then
      raise exception 'Esse estudo está dentro do que você escolheu.';
    end if;
    select estudo_pai_id into atual from public.estudos where id = atual;
  end loop;
  return new;
end $$;

drop trigger if exists estudos_sem_ciclo on public.estudos;
create trigger estudos_sem_ciclo
  before insert or update of estudo_pai_id on public.estudos
  for each row execute function public.estudos_sem_ciclo();
