-- O certificado só pode ser emitido depois da última aula ao vivo (aula ao vivo sem data conta como ainda não aconteceu).
create or replace function public.emitir_certificado(p_curso uuid, p_nome text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_nome text := btrim(coalesce(p_nome, ''));
  v_cert curso_certificados%rowtype; v_data date; v_codigo text; v_curso text;
begin
  if not exists (select 1 from curso_matriculas where curso_id = p_curso and lower(email) = v_email) then raise exception 'sem acesso'; end if;
  select * into v_cert from curso_certificados where curso_id = p_curso and lower(email) = v_email;
  if not found then
    if length(v_nome) < 3 then return jsonb_build_object('ok', false, 'motivo', 'nome'); end if;
    if not exists (select 1 from curso_modulos mo where mo.curso_id = p_curso and exists (select 1 from curso_av_perguntas q where q.modulo_id = mo.id))
       or exists (select 1 from curso_modulos mo where mo.curso_id = p_curso and exists (select 1 from curso_av_perguntas q where q.modulo_id = mo.id)
                  and not exists (select 1 from curso_av_tentativas t where t.modulo_id = mo.id and lower(t.email) = v_email and t.aprovado)) then
      return jsonb_build_object('ok', false, 'motivo', 'faltam_modulos');
    end if;
    if exists (select 1 from curso_aulas a join curso_modulos mo on mo.id = a.modulo_id
               where mo.curso_id = p_curso and a.tipo = 'ao_vivo' and (a.data_hora is null or a.data_hora > now())) then
      return jsonb_build_object('ok', false, 'motivo', 'aguarde_ao_vivo');
    end if;
    select (max(t.criado_em) at time zone 'America/Sao_Paulo')::date into v_data
      from curso_av_tentativas t join curso_modulos mo on mo.id = t.modulo_id where mo.curso_id = p_curso and lower(t.email) = v_email and t.aprovado;
    loop
      v_codigo := 'FDA-' || upper(substr(md5(gen_random_uuid()::text), 1, 4)) || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 4));
      exit when not exists (select 1 from curso_certificados where codigo = v_codigo);
    end loop;
    insert into curso_certificados (curso_id, email, nome, codigo, concluido_em) values (p_curso, v_email, v_nome, v_codigo, v_data) returning * into v_cert;
  end if;
  select titulo into v_curso from cursos where id = p_curso;
  return jsonb_build_object('ok', true, 'codigo', v_cert.codigo, 'nome', v_cert.nome, 'curso', v_curso, 'concluido_em', v_cert.concluido_em);
end $$;
revoke all on function public.emitir_certificado(uuid, text) from public;
grant execute on function public.emitir_certificado(uuid, text) to authenticated;
