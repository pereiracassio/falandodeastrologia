-- Avisos no celular (Web Push) das atividades — rodar UMA vez no Supabase: SQL Editor -> New query -> colar tudo -> Run.
-- Só o servidor (Vercel, chave de serviço) lê e grava esta tabela; o navegador nunca acessa direto (RLS ligada, sem policy).

create table public.push_inscricoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  aparelho text,
  criado_em timestamptz not null default now()
);
create index push_inscricoes_email_idx on public.push_inscricoes (lower(email));
alter table public.push_inscricoes enable row level security;
grant all on public.push_inscricoes to service_role;

-- Chaves dos avisos (geradas pelo próprio servidor na primeira vez; a privada fica cifrada). Só a chave de serviço lê.
create table public.push_chaves (
  id int primary key default 1 check (id = 1),
  publica text not null,
  privada text not null,
  criado_em timestamptz not null default now()
);
alter table public.push_chaves enable row level security;
grant all on public.push_chaves to service_role;
