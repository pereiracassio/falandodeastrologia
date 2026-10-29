-- Aviso de material novo e de gravação nova, gravados pelo próprio banco (sem Vercel) — rodar UMA vez no Supabase: SQL Editor -> New query -> colar tudo -> Run.

-- a peça comum passa a comparar também o texto: duas gravações seguidas (títulos diferentes) avisam as duas; a correção (mesmo texto, uma linha por pergunta) continua avisando uma vez só
create or replace function public.criar_aviso(p_email text, p_titulo text, p_corpo text, p_url text, p_atividade uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(trim(p_email), '') = '' then return; end if;
  if exists (
    select 1 from public.avisos_recebidos
    where lower(email) = lower(p_email) and titulo = p_titulo and url = p_url and corpo = p_corpo and criado_em > now() - interval '2 minutes'
  ) then return; end if;
  insert into public.avisos_recebidos (email, titulo, corpo, url, atividade_id)
  values (lower(p_email), p_titulo, p_corpo, p_url, p_atividade);
end $$;
revoke all on function public.criar_aviso(text, text, text, text, uuid) from public;
create or replace function public.trg_aviso_item() returns trigger
language plpgsql security definer set search_path = public as $$
declare alu record; primeiro text; aba text;
begin
  select id, nome, email into alu from public.alunos where id = new.aluno_id;
  if alu.id is null then return new; end if;
  primeiro := coalesce(nullif(split_part(trim(coalesce(alu.nome, '')), ' ', 1), ''), 'aluno');
  aba := case when new.bloco in ('gravacoes', 'materiais', 'caderno') then new.bloco else 'materiais' end;
  if new.bloco = 'gravacoes' then
    perform public.criar_aviso(alu.email, 'Gravação disponível', 'Oi, ' || primeiro || '! Já disponibilizei a gravação do nosso encontro: ' || left(coalesce(new.titulo, ''), 120), '/aluno.html?aba=' || aba, null);
  else
    perform public.criar_aviso(alu.email, 'Material novo', 'Oi, ' || primeiro || '! Deixei um novo material para você: ' || left(coalesce(new.titulo, ''), 120), '/aluno.html?aba=' || aba, null);
  end if;
  return new;
end $$;
drop trigger if exists aviso_item on public.itens;
create trigger aviso_item after insert on public.itens
  for each row execute function public.trg_aviso_item();
