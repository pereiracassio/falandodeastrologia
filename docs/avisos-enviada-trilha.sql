-- Aviso para o administrador quando o aluno envia uma atividade, e aviso para o aluno quando ganha uma trilha nova — gravados pelo próprio banco (sem Vercel).
-- Rodar UMA vez no Supabase: SQL Editor -> New query -> colar tudo -> Run.

-- aluno enviou a atividade para correção: avisa quem administra
create or replace function public.trg_aviso_atividade_enviada() returns trigger
language plpgsql security definer set search_path = public as $$
declare alu record; adm record; primeiro text;
begin
  if new.enviada_em is null or old.enviada_em is not null or coalesce(new.somente_leitura, false) then return new; end if;
  select id, nome into alu from public.alunos where id = new.aluno_id;
  if alu.id is null then return new; end if;
  primeiro := coalesce(nullif(split_part(trim(coalesce(alu.nome, '')), ' ', 1), ''), 'O aluno');
  for adm in select email from public.admins where coalesce(email, '') <> '' loop
    perform public.criar_aviso(adm.email, 'Atividade enviada', primeiro || ' enviou: ' || left(coalesce(new.titulo, ''), 120), '/admin-alunos.html#aluno=' || alu.id || '&atividade=' || new.id, new.id);
  end loop;
  return new;
end $$;
drop trigger if exists aviso_atividade_enviada on public.atividades;
create trigger aviso_atividade_enviada after update of enviada_em on public.atividades
  for each row execute function public.trg_aviso_atividade_enviada();

-- trilha nova para o aluno: avisa o aluno
create or replace function public.trg_aviso_trilha_nova() returns trigger
language plpgsql security definer set search_path = public as $$
declare alu record; primeiro text;
begin
  select id, nome, email into alu from public.alunos where id = new.aluno_id;
  if alu.id is null then return new; end if;
  primeiro := coalesce(nullif(split_part(trim(coalesce(alu.nome, '')), ' ', 1), ''), 'aluno');
  perform public.criar_aviso(alu.email, 'Trilha nova', 'Oi, ' || primeiro || '! Deixei uma nova trilha para você: ' || left(coalesce(new.nome, ''), 120), '/aluno.html?aba=trilha', null);
  return new;
end $$;
drop trigger if exists aviso_trilha_nova on public.aluno_trilhas;
create trigger aviso_trilha_nova after insert on public.aluno_trilhas
  for each row execute function public.trg_aviso_trilha_nova();
