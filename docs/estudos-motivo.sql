-- Estudos: "Por que errei?" (atencao, conceito ou conta). Rodar UMA vez no Supabase.
alter table public.estudo_respostas add column if not exists motivo text;
