-- Atividades (perguntas de múltipla escolha e dissertativas) — rodar UMA vez no Supabase: SQL Editor -> New query -> colar tudo -> Run.
-- Usa public.sou_admin() (docs/portal-aluno.sql). Cada aluno tem as suas atividades.

create table public.atividades (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.alunos(id) on delete cascade,
  titulo text not null,
  descricao text,
  criado_em timestamptz not null default now(),
  enviada_em timestamptz
);
create table public.atividade_perguntas (
  id uuid primary key default gen_random_uuid(),
  atividade_id uuid not null references public.atividades(id) on delete cascade,
  ordem int not null default 0,
  tipo text not null check (tipo in ('multipla','dissertativa')),
  enunciado text not null,
  opcoes jsonb
);
-- gabarito fica À PARTE: só o administrador lê (o aluno consegue ler a pergunta, mas não a resposta certa)
create table public.atividade_gabarito (
  pergunta_id uuid primary key references public.atividade_perguntas(id) on delete cascade,
  correta int not null
);
create table public.atividade_respostas (
  pergunta_id uuid primary key references public.atividade_perguntas(id) on delete cascade,
  texto text,
  opcao int,
  atualizado_em timestamptz not null default now()
);
create table public.atividade_correcoes (
  pergunta_id uuid primary key references public.atividade_perguntas(id) on delete cascade,
  situacao text check (situacao in ('certo','errado','parcial')),
  comentario text
);

alter table public.atividades enable row level security;
alter table public.atividade_perguntas enable row level security;
alter table public.atividade_gabarito enable row level security;
alter table public.atividade_respostas enable row level security;
alter table public.atividade_correcoes enable row level security;

grant select, insert, update, delete on public.atividades, public.atividade_perguntas, public.atividade_gabarito,
  public.atividade_respostas, public.atividade_correcoes to authenticated;

-- "essa atividade/pergunta é do aluno que está logado?" (pelo e-mail, como nas outras tabelas)
create function public.atividade_e_minha(p_atividade uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.atividades t join public.alunos a on a.id = t.aluno_id
    where t.id = p_atividade and lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
create function public.pergunta_e_minha(p_pergunta uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.atividade_perguntas q
    where q.id = p_pergunta and public.atividade_e_minha(q.atividade_id)
  );
$$;
-- o aluno só mexe nas respostas enquanto a atividade NÃO foi enviada
create function public.pergunta_editavel(p_pergunta uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.atividade_perguntas q join public.atividades t on t.id = q.atividade_id
    where q.id = p_pergunta and t.enviada_em is null and public.atividade_e_minha(t.id)
  );
$$;
create function public.enviar_atividade(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.atividade_e_minha(p_id) then raise exception 'sem permissão'; end if;
  update public.atividades set enviada_em = now() where id = p_id and enviada_em is null;
end;
$$;

create policy atividades_ler on public.atividades for select to authenticated
  using (public.sou_admin() or public.atividade_e_minha(id));
create policy atividades_admin_inserir on public.atividades for insert to authenticated with check (public.sou_admin());
create policy atividades_admin_editar on public.atividades for update to authenticated using (public.sou_admin()) with check (public.sou_admin());
create policy atividades_admin_apagar on public.atividades for delete to authenticated using (public.sou_admin());

create policy perguntas_ler on public.atividade_perguntas for select to authenticated
  using (public.sou_admin() or public.atividade_e_minha(atividade_id));
create policy perguntas_admin_inserir on public.atividade_perguntas for insert to authenticated with check (public.sou_admin());
create policy perguntas_admin_editar on public.atividade_perguntas for update to authenticated using (public.sou_admin()) with check (public.sou_admin());
create policy perguntas_admin_apagar on public.atividade_perguntas for delete to authenticated using (public.sou_admin());

create policy gabarito_so_admin on public.atividade_gabarito for all to authenticated
  using (public.sou_admin()) with check (public.sou_admin());

create policy respostas_ler on public.atividade_respostas for select to authenticated
  using (public.sou_admin() or public.pergunta_e_minha(pergunta_id));
create policy respostas_aluno_inserir on public.atividade_respostas for insert to authenticated
  with check (public.sou_admin() or public.pergunta_editavel(pergunta_id));
create policy respostas_aluno_atualizar on public.atividade_respostas for update to authenticated
  using (public.sou_admin() or public.pergunta_editavel(pergunta_id))
  with check (public.sou_admin() or public.pergunta_editavel(pergunta_id));
create policy respostas_admin_apagar on public.atividade_respostas for delete to authenticated using (public.sou_admin());

create policy correcoes_ler on public.atividade_correcoes for select to authenticated
  using (public.sou_admin() or public.pergunta_e_minha(pergunta_id));
create policy correcoes_admin_escrever on public.atividade_correcoes for all to authenticated
  using (public.sou_admin()) with check (public.sou_admin());
