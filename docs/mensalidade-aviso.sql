-- Aviso da mensalidade na página do aluno — rodar UMA vez no Supabase: SQL Editor -> New query -> colar tudo -> Run.
-- O aluno só consegue ver a PRÓPRIA data de vencimento (a função devolve só essa data, nunca a tabela de pagamentos). O administrador pode pedir a de um aluno (modo "Ver como aluno").
create or replace function public.meu_vencimento(p_aluno uuid default null)
returns date language plpgsql stable security definer set search_path = public as $$
declare alu uuid; venc date;
begin
  if p_aluno is not null and public.sou_admin() then
    alu := p_aluno;
  else
    select id into alu from public.alunos where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) limit 1;
  end if;
  if alu is null then return null; end if;
  select proximo_pagamento into venc from public.aluno_pagamentos where aluno_id = alu;
  return venc;
end $$;
revoke all on function public.meu_vencimento(uuid) from public;
grant execute on function public.meu_vencimento(uuid) to authenticated;
