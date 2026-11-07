-- Data limite para responder uma atividade (o aluno vê "Responder até ..." enquanto não enviar)
alter table public.atividades add column if not exists data_limite date;
