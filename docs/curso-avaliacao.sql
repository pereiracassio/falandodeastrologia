-- Avaliação do módulo (curso): perguntas de marcar, gabarito só do administrador, tentativas e a função que corrige e libera o próximo módulo.
create table if not exists public.curso_av_perguntas (
  id uuid primary key default gen_random_uuid(),
  modulo_id uuid not null references public.curso_modulos(id) on delete cascade,
  ordem int not null default 0,
  enunciado text not null,
  opcoes jsonb not null default '[]',
  criado_em timestamptz not null default now()
);
create table if not exists public.curso_av_gabarito (
  pergunta_id uuid primary key references public.curso_av_perguntas(id) on delete cascade,
  correta int not null
);
create table if not exists public.curso_av_tentativas (
  id uuid primary key default gen_random_uuid(),
  modulo_id uuid not null references public.curso_modulos(id) on delete cascade,
  email text not null,
  nota numeric(4,1) not null,
  acertos int not null,
  total int not null,
  aprovado boolean not null,
  respostas jsonb not null default '{}',
  resultado jsonb not null default '{}',
  criado_em timestamptz not null default now()
);
create index if not exists curso_av_tentativas_busca on public.curso_av_tentativas (modulo_id, lower(email));
alter table public.curso_av_perguntas enable row level security;
alter table public.curso_av_gabarito enable row level security;
alter table public.curso_av_tentativas enable row level security;
drop policy if exists "admin curso_av_perguntas" on public.curso_av_perguntas;
create policy "admin curso_av_perguntas" on public.curso_av_perguntas for all to authenticated using (public.sou_admin()) with check (public.sou_admin());
drop policy if exists "admin curso_av_gabarito" on public.curso_av_gabarito;
create policy "admin curso_av_gabarito" on public.curso_av_gabarito for all to authenticated using (public.sou_admin()) with check (public.sou_admin());
drop policy if exists "admin curso_av_tentativas" on public.curso_av_tentativas;
create policy "admin curso_av_tentativas" on public.curso_av_tentativas for all to authenticated using (public.sou_admin()) with check (public.sou_admin());
drop policy if exists "aluno le as perguntas liberadas" on public.curso_av_perguntas;
create policy "aluno le as perguntas liberadas" on public.curso_av_perguntas for select to authenticated
  using (exists (select 1 from public.curso_modulos mo join public.curso_matriculas m on m.curso_id = mo.curso_id
    where mo.id = curso_av_perguntas.modulo_id and mo.ordem <= m.modulo_liberado and lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))));
drop policy if exists "aluno le as proprias tentativas" on public.curso_av_tentativas;
create policy "aluno le as proprias tentativas" on public.curso_av_tentativas for select to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
grant select, insert, update, delete on public.curso_av_perguntas, public.curso_av_gabarito, public.curso_av_tentativas to authenticated;
grant all on public.curso_av_perguntas, public.curso_av_gabarito, public.curso_av_tentativas to service_role;

create or replace function public.enviar_avaliacao(p_modulo uuid, p_respostas jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_curso uuid; v_ord int; v_lib int; v_mat uuid;
  v_total int; v_acertos int; v_nota numeric; v_aprov boolean;
  v_ult timestamptz; v_prox int; v_res jsonb;
begin
  select curso_id, ordem into v_curso, v_ord from curso_modulos where id = p_modulo;
  if v_curso is null then raise exception 'módulo não encontrado'; end if;
  select id, modulo_liberado into v_mat, v_lib from curso_matriculas where curso_id = v_curso and lower(email) = v_email limit 1;
  if v_mat is null or v_ord > v_lib then raise exception 'sem acesso'; end if;
  if exists (select 1 from curso_av_tentativas where modulo_id = p_modulo and lower(email) = v_email and aprovado) then
    return jsonb_build_object('ok', false, 'motivo', 'aprovado');
  end if;
  select max(criado_em) into v_ult from curso_av_tentativas where modulo_id = p_modulo and lower(email) = v_email;
  if v_ult is not null and v_ult + interval '24 hours' > now() then
    return jsonb_build_object('ok', false, 'motivo', 'espere', 'libera_em', v_ult + interval '24 hours');
  end if;
  select count(*) into v_total from curso_av_perguntas where modulo_id = p_modulo;
  if v_total = 0 then raise exception 'sem perguntas'; end if;
  select coalesce(jsonb_object_agg(p.id::text,
           case when (p_respostas ->> p.id::text) ~ '^[0-9]+$' then (p_respostas ->> p.id::text)::int = g.correta else false end), '{}'::jsonb)
    into v_res
    from curso_av_perguntas p left join curso_av_gabarito g on g.pergunta_id = p.id where p.modulo_id = p_modulo;
  select count(*) into v_acertos from jsonb_each(v_res) where value = 'true'::jsonb;
  v_nota := round(v_acertos::numeric / v_total * 10, 1);
  v_aprov := v_nota >= 7;
  insert into curso_av_tentativas (modulo_id, email, nota, acertos, total, aprovado, respostas, resultado)
    values (p_modulo, v_email, v_nota, v_acertos, v_total, v_aprov, coalesce(p_respostas, '{}'::jsonb), v_res);
  if v_aprov and v_lib = v_ord then
    select min(ordem) into v_prox from curso_modulos where curso_id = v_curso and ordem > v_ord;
    if v_prox is not null then update curso_matriculas set modulo_liberado = v_prox where id = v_mat; end if;
  end if;
  return jsonb_build_object('ok', true, 'nota', v_nota, 'acertos', v_acertos, 'total', v_total, 'aprovado', v_aprov, 'resultado', v_res);
end $$;
revoke all on function public.enviar_avaliacao(uuid, jsonb) from public;
grant execute on function public.enviar_avaliacao(uuid, jsonb) to authenticated;
