-- To do com horário: avisa no celular na hora marcada (a cada minuto o banco confere). Tarefa "o dia todo" (sem hora) não avisa.
alter table public.todo_tarefas add column if not exists avisada boolean not null default false;

-- o que já passou do horário não dispara aviso agora
update public.todo_tarefas set avisada = true
 where case when nullif(hora::text, '') is null then false
            else (data::date < (now() at time zone 'America/Sao_Paulo')::date
                  or (data::date = (now() at time zone 'America/Sao_Paulo')::date and hora::text::time <= (now() at time zone 'America/Sao_Paulo')::time)) end;

-- mudou o dia ou a hora: avisa de novo no novo horário
create or replace function public.trg_tarefa_hora_mudou() returns trigger language plpgsql as $$
begin
  if new.data is distinct from old.data or new.hora is distinct from old.hora then new.avisada := false; end if;
  return new;
end $$;
drop trigger if exists tarefa_hora_mudou on public.todo_tarefas;
create trigger tarefa_hora_mudou before update of data, hora on public.todo_tarefas
  for each row execute function public.trg_tarefa_hora_mudou();

create or replace function public.avisar_tarefas_na_hora() returns void
language plpgsql security definer set search_path = public as $$
declare t record; agora timestamp := (now() at time zone 'America/Sao_Paulo');
begin
  for t in select id, titulo, nullif(hora::text, '') as h from public.todo_tarefas
           where feito = false and avisada = false and data::date = agora::date loop
    if t.h is not null and t.h::time <= agora::time then
      perform public.avisar_admins('Tarefa', left(coalesce(t.titulo, ''), 120) || ' · ' || to_char(t.h::time, 'HH24:MI'), '/admin-caderno.html');
      update public.todo_tarefas set avisada = true where id = t.id;
    end if;
  end loop;
end $$;
revoke all on function public.avisar_tarefas_na_hora() from public;

select cron.schedule('avisar-tarefas-na-hora', '* * * * *', 'select public.avisar_tarefas_na_hora()');
