-- Estudos: figura da questão (imagem da prova). Rodar UMA vez no Supabase.
alter table public.estudo_questoes add column if not exists imagem text;
