-- (registro; já rodado em 12/11/2026) Aviso no celular no dia em que a atividade abre, todo dia às 8h de Brasília (11h UTC)
create extension if not exists pg_cron;
alter table public.atividades add column if not exists inicio_avisado boolean not null default true;

create or replace function public.trg_atividade_inicio_futuro() returns trigger
language plpgsql as $$
begin
  if new.data_inicio is not null and new.data_inicio > (now() at time zone 'America/Sao_Paulo')::date then
    new.inicio_avisado := false;
  end if;
  return new;
end $$;
drop trigger if exists atividade_inicio_futuro on public.atividades;
create trigger atividade_inicio_futuro before insert or update of data_inicio on public.atividades
  for each row execute function public.trg_atividade_inicio_futuro();

create or replace function public.avisar_atividades_liberadas() returns void
language plpgsql security definer set search_path = public as $$
declare a record; primeiro text;
begin
  for a in
    select t.id, t.titulo, t.somente_leitura, al.nome, al.email
    from public.atividades t join public.alunos al on al.id = t.aluno_id
    where t.inicio_avisado = false and not t.rascunho and not coalesce(t.antiga, false)
      and t.data_inicio <= (now() at time zone 'America/Sao_Paulo')::date
  loop
    primeiro := coalesce(nullif(split_part(trim(coalesce(a.nome, '')), ' ', 1), ''), 'aluno');
    if coalesce(a.somente_leitura, false) then
      perform public.criar_aviso(a.email, 'Material novo', 'Oi, ' || primeiro || '! Deixei um novo material para você: ' || left(coalesce(a.titulo, ''), 120), '/aluno.html?atividade=' || a.id, a.id);
    else
      perform public.criar_aviso(a.email, 'Atividade nova', 'Oi, ' || primeiro || '! Deixei uma nova atividade para você: ' || left(coalesce(a.titulo, ''), 120), '/aluno.html?atividade=' || a.id, a.id);
    end if;
    update public.atividades set inicio_avisado = true where id = a.id;
  end loop;
end $$;

select cron.schedule('avisar-atividades-liberadas', '0 11 * * *', 'select public.avisar_atividades_liberadas()');
