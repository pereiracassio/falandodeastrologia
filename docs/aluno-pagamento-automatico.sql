-- Pagamento do aluno registrado sozinho pelo Financeiro. O vencimento é FIXO: o próximo é 1 mês depois do vencimento anterior
-- (pagar atrasado não muda o dia). Sem vencimento ainda, 1 mês depois do pagamento. Rodar UMA vez no Supabase.
create or replace function public.fin_entrada_marca_aluno()
returns trigger language plpgsql security definer set search_path = public as $$
declare cod text; alu uuid; antigo date; venc date;
begin
  if new.cliente_nome is null or new.produto is null then return new; end if;
  if new.produto !~* '(mentoria|acompanhamento)' then return new; end if;
  cod := substring(new.cliente_nome from '^\s*(\d{3,6})\b');
  if cod is null then return new; end if;
  select aluno_id into alu from public.aluno_codigos where ltrim(codigo, '0') = ltrim(cod, '0') limit 1;
  if alu is null then return new; end if;
  select ultimo_pagamento, proximo_pagamento into antigo, venc from public.aluno_pagamentos where aluno_id = alu;
  if antigo is not null and antigo >= new.data then return new; end if;
  insert into public.aluno_pagamentos (aluno_id, ultimo_pagamento, proximo_pagamento)
  values (alu, new.data, (coalesce(venc, new.data) + interval '1 month')::date)
  on conflict (aluno_id) do update set ultimo_pagamento = excluded.ultimo_pagamento, proximo_pagamento = excluded.proximo_pagamento;
  return new;
end $$;
