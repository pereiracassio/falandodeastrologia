-- Estudos (aba Estudos do painel): aulas, questões e respostas do administrador.
-- Rodar UMA vez no Supabase: SQL Editor -> New query -> colar tudo -> Run. Usa public.sou_admin().

create table public.estudo_aulas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,            -- ex.: 2026-10-26-mat (a importação usa isto para atualizar sem duplicar)
  data date not null,                     -- dia em que a aula entra no plano
  materia text not null,
  titulo text not null,
  explicacao text,                        -- parágrafos separados por linha em branco; "## " no começo da linha = subtítulo
  criado_em timestamptz not null default now()
);
create table public.estudo_questoes (
  id uuid primary key default gen_random_uuid(),
  aula_id uuid not null references public.estudo_aulas(id) on delete cascade,
  ordem int not null,
  tipo text not null check (tipo in ('multipla','dissertativa')),
  enunciado text not null,
  opcoes jsonb,
  correta int,                            -- só na múltipla escolha (posição da alternativa certa, começando em 0)
  resolucao text,                         -- aparece depois que você responde
  espaco_conta boolean not null default false, -- true = a questão traz um quadro para fazer a conta à mão (Apple Pencil)
  unique (aula_id, ordem)
);
create table public.estudo_respostas (
  questao_id uuid primary key references public.estudo_questoes(id) on delete cascade,
  opcao int,
  texto text,
  desenho text,                           -- o que foi escrito à mão no quadro (imagem PNG)
  atualizado_em timestamptz not null default now()
);

alter table public.estudo_aulas enable row level security;
alter table public.estudo_questoes enable row level security;
alter table public.estudo_respostas enable row level security;

grant select, insert, update, delete on public.estudo_aulas, public.estudo_questoes, public.estudo_respostas to authenticated;

create policy "admin estudo_aulas" on public.estudo_aulas for all to authenticated using (public.sou_admin()) with check (public.sou_admin());
create policy "admin estudo_questoes" on public.estudo_questoes for all to authenticated using (public.sou_admin()) with check (public.sou_admin());
create policy "admin estudo_respostas" on public.estudo_respostas for all to authenticated using (public.sou_admin()) with check (public.sou_admin());
