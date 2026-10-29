-- Atividade em rascunho: o aluno não vê até o administrador enviar
alter table public.atividades add column if not exists rascunho boolean not null default false;

create or replace function public.atividade_e_minha(p_atividade uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.atividades t join public.alunos a on a.id = t.aluno_id
    where t.id = p_atividade and not t.rascunho and lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
