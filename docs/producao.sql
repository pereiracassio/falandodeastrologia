-- Produção de vídeos (séries, vídeos e cortes) — rodar UMA vez no Supabase: SQL Editor -> New query -> colar tudo -> Run.
-- Usa public.sou_admin() (docs/portal-aluno.sql). Tudo só do administrador.

create table public.prod_series (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  assunto text,                 -- assunto do blog (geralmente o nome da série)
  dia_semana int check (dia_semana between 0 and 6),  -- 0 domingo ... 6 sábado
  inicio date,
  total int,
  criado_em timestamptz not null default now()
);
create table public.prod_videos (
  id uuid primary key default gen_random_uuid(),
  serie_id uuid references public.prod_series(id) on delete cascade,  -- nulo = vídeo solto
  numero int,
  titulo text not null,
  roteiro text,
  texto_postagem text,
  data_postar date,
  link_youtube text,
  roteiro_ok boolean not null default false,
  gravado boolean not null default false,
  editado boolean not null default false,
  no_ar boolean not null default false,
  cortes_feitos boolean not null default false,
  blog_ok boolean not null default false,
  criado_em timestamptz not null default now()
);
create table public.prod_cortes (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.prod_videos(id) on delete cascade,
  ordem int not null default 0,
  titulo text,
  data date,
  instagram boolean not null default false,
  tiktok boolean not null default false,
  shorts boolean not null default false,
  criado_em timestamptz not null default now()
);

alter table public.prod_series enable row level security;
alter table public.prod_videos enable row level security;
alter table public.prod_cortes enable row level security;
create policy prod_series_admin on public.prod_series for all to authenticated using (public.sou_admin()) with check (public.sou_admin());
create policy prod_videos_admin on public.prod_videos for all to authenticated using (public.sou_admin()) with check (public.sou_admin());
create policy prod_cortes_admin on public.prod_cortes for all to authenticated using (public.sou_admin()) with check (public.sou_admin());

grant select, insert, update, delete on public.prod_series, public.prod_videos, public.prod_cortes to authenticated;
grant all on public.prod_series, public.prod_videos, public.prod_cortes to service_role;

-- (24/10) Capa do vídeo: texto escrito na capa e a foto (mesma pasta e mesmo endereço que o blog usa).
alter table public.prod_videos add column if not exists capa_texto text;
alter table public.prod_videos add column if not exists capa_url text;

-- (24/10) Ligação do vídeo com a postagem do blog (guarda o id da postagem; sem chave estrangeira de propósito).
alter table public.prod_videos add column if not exists blog_post_id text;
