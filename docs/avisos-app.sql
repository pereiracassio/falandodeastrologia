-- Avisos no celular separados por app (Hellenic Daily / Falando de Astrologia). JÁ RODADO em 04/11/2026. A função quick-service também foi atualizada (cópia em supabase/functions/avisos/index.ts).
alter table public.push_inscricoes add column if not exists app text not null default 'falando';

create or replace function public.registrar_aparelho(p_endpoint text, p_p256dh text, p_auth text, p_aparelho text default null, p_app text default 'falando')
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); mail text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if uid is null or mail = '' then raise exception 'sem login'; end if;
  if p_endpoint !~ '^https://' then raise exception 'inscrição inválida'; end if;
  insert into public.push_inscricoes (user_id, email, endpoint, p256dh, auth, aparelho, app)
  values (uid, mail, p_endpoint, p_p256dh, p_auth, left(p_aparelho, 160), case when p_app = 'daily' then 'daily' else 'falando' end)
  on conflict (endpoint) do update set user_id = excluded.user_id, email = excluded.email, p256dh = excluded.p256dh, auth = excluded.auth, aparelho = excluded.aparelho, app = excluded.app;
end $$;

drop function if exists public.registrar_aparelho(text, text, text, text);
revoke all on function public.registrar_aparelho(text, text, text, text, text) from public;
grant execute on function public.registrar_aparelho(text, text, text, text, text) to authenticated;
