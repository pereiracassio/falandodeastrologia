-- Avisos gravados pelo próprio banco (sem Vercel) — rodar UMA vez no Supabase: SQL Editor -> New query -> colar tudo -> Run.
-- Quando você cria uma atividade (ou envia um rascunho) ou salva uma correção, o banco grava o aviso na lista do aluno sozinho.

-- Peça comum: grava um aviso na lista de quem recebe. Não repete o mesmo aviso dentro de 2 minutos (a correção grava uma linha por pergunta).
create or replace function public.criar_aviso(p_email text, p_titulo text, p_corpo text, p_url text, p_atividade uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(trim(p_email), '') = '' then return; end if;
  if exists (
    select 1 from public.avisos_recebidos
    where lower(email) = lower(p_email) and titulo = p_titulo and url = p_url and criado_em > now() - interval '2 minutes'
  ) then return; end if;
  insert into public.avisos_recebidos (email, titulo, corpo, url, atividade_id)
  values (lower(p_email), p_titulo, p_corpo, p_url, p_atividade);
end $$;
revoke all on function public.criar_aviso(text, text, text, text, uuid) from public;

-- Atividade nova (ou rascunho que acabou de ser enviado): avisa o aluno
create or replace function public.trg_aviso_atividade_nova() returns trigger
language plpgsql security definer set search_path = public as $$
declare alu record; primeiro text;
begin
  if new.rascunho is true or coalesce(new.antiga, false) then return new; end if;
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
drop trigger if exists aviso_atividade_nova on public.atividades;
create trigger aviso_atividade_nova after insert or update of rascunho on public.atividades
  for each row execute function public.trg_aviso_atividade_nova();

-- Correção salva: avisa o aluno
create or replace function public.trg_aviso_correcao() returns trigger
language plpgsql security definer set search_path = public as $$
declare atv record; alu record; primeiro text;
begin
  if new.situacao is null and new.comentario is null then return new; end if;
  if tg_op = 'UPDATE' and new.situacao is not distinct from old.situacao and new.comentario is not distinct from old.comentario then return new; end if;
  select t.id, t.titulo, t.aluno_id, t.rascunho into atv
    from public.atividade_perguntas q join public.atividades t on t.id = q.atividade_id where q.id = new.pergunta_id;
  if atv.id is null or atv.rascunho is true then return new; end if;
  select id, nome, email into alu from public.alunos where id = atv.aluno_id;
  if alu.id is null then return new; end if;
  primeiro := coalesce(nullif(split_part(trim(coalesce(alu.nome, '')), ' ', 1), ''), 'aluno');
  perform public.criar_aviso(alu.email, 'Atividade corrigida', 'Oi, ' || primeiro || '! Corrigi a sua atividade: ' || left(coalesce(atv.titulo, ''), 120), '/aluno.html?atividade=' || atv.id, atv.id);
  return new;
end $$;
drop trigger if exists aviso_correcao on public.atividade_correcoes;
create trigger aviso_correcao after insert or update on public.atividade_correcoes
  for each row execute function public.trg_aviso_correcao();
