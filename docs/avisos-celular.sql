-- Alarme no celular pelo Supabase (sem Vercel) — rodar UMA vez: SQL Editor -> New query -> colar tudo -> Run.
create extension if not exists pg_net with schema extensions;

alter table public.avisos_recebidos add column if not exists push_enviado_em timestamptz;
alter table public.avisos_recebidos add column if not exists push_resultado text;
-- o que já existe não deve ser mandado de novo
update public.avisos_recebidos set push_enviado_em = now() where push_enviado_em is null;

-- chaves antigas (cifradas pela Vercel) não servem aqui: a função cria as novas na primeira chamada. Cada aparelho ativa os avisos de novo uma vez.
delete from public.push_chaves;
delete from public.push_inscricoes;

-- o aparelho se cadastra e se descadastra direto no banco; quem é a pessoa vem do login
create or replace function public.registrar_aparelho(p_endpoint text, p_p256dh text, p_auth text, p_aparelho text default null)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); mail text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if uid is null or mail = '' then raise exception 'sem login'; end if;
  if p_endpoint !~ '^https://' then raise exception 'inscrição inválida'; end if;
  insert into public.push_inscricoes (user_id, email, endpoint, p256dh, auth, aparelho)
  values (uid, mail, p_endpoint, p_p256dh, p_auth, left(p_aparelho, 160))
  on conflict (endpoint) do update set user_id = excluded.user_id, email = excluded.email, p256dh = excluded.p256dh, auth = excluded.auth, aparelho = excluded.aparelho;
end $$;
create or replace function public.remover_aparelho(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from public.push_inscricoes where endpoint = p_endpoint and user_id = auth.uid();
$$;
revoke all on function public.registrar_aparelho(text, text, text, text) from public;
revoke all on function public.remover_aparelho(text) from public;
grant execute on function public.registrar_aparelho(text, text, text, text) to authenticated;
grant execute on function public.remover_aparelho(text) to authenticated;

-- toda vez que um aviso é gravado, o banco chama a função "avisos" (nunca atrapalha a gravação se falhar)
create or replace function public.trg_push_aviso() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  begin
    perform net.http_post(
      url := 'https://wqkgsotfwkzjwaowenrb.supabase.co/functions/v1/quick-service',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := jsonb_build_object('id', new.id)
    );
  exception when others then
    null;
  end;
  return new;
end $$;
drop trigger if exists push_aviso on public.avisos_recebidos;
create trigger push_aviso after insert on public.avisos_recebidos
  for each row execute function public.trg_push_aviso();
