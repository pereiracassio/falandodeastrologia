-- Atividade com dia de início: o aluno só vê e responde a partir desse dia (Brasília). Sem data = como sempre foi.
alter table public.atividades add column if not exists data_inicio date;

create or replace function public.atividade_e_minha(p_atividade uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.atividades t join public.alunos a on a.id = t.aluno_id
    where t.id = p_atividade and not t.rascunho
      and (t.data_inicio is null or t.data_inicio <= (now() at time zone 'America/Sao_Paulo')::date)
      and lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- não avisa o aluno de uma atividade que ainda não abriu
create or replace function public.trg_aviso_atividade_nova() returns trigger
language plpgsql security definer set search_path = public as $$
declare alu record; primeiro text;
begin
  if new.rascunho is true or coalesce(new.antiga, false) then return new; end if;
  if new.data_inicio is not null and new.data_inicio > (now() at time zone 'America/Sao_Paulo')::date then return new; end if;
  if tg_op = 'UPDATE' and not (old.rascunho is true) then return new; end if;
  select id, nome, email into alu from public.alunos where id = new.aluno_id;
  if alu.id is null then return new; end if;
  primeiro := coalesce(nullif(split_part(trim(coalesce(alu.nome, '')), ' ', 1), ''), 'aluno');
  if coalesce(new.somente_leitura, false) then
    perform public.criar_aviso(alu.email, 'Material novo', 'Oi, ' || primeiro || '! Deixei um novo material para você: ' || left(coalesce(new.titulo, ''), 120), '/aluno.html?atividade=' || new.id, new.id);
  else
    perform public.criar_aviso(alu.email, 'Atividade nova', 'Oi, ' || primeiro || '! Deixei uma nova atividade para você: ' || left(coalesce(new.titulo, ''), 120), '/aluno.html?atividade=' || new.id, new.id);
  end if;
  return new;
end $$;
