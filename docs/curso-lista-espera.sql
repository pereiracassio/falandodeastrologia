create table if not exists public.curso_lista_espera (
  id uuid primary key default gen_random_uuid(),
  curso text not null default 'fundamentos',
  nome text not null,
  email text not null,
  whatsapp text not null,
  criado_em timestamptz not null default now()
);
create unique index if not exists curso_lista_espera_email on public.curso_lista_espera (curso, lower(email));
alter table public.curso_lista_espera enable row level security;
drop policy if exists "admin curso_lista_espera" on public.curso_lista_espera;
create policy "admin curso_lista_espera" on public.curso_lista_espera for all to authenticated using (public.sou_admin()) with check (public.sou_admin());
grant select, insert, update, delete on public.curso_lista_espera to authenticated;
grant all on public.curso_lista_espera to service_role;

-- a página pública só consegue ENTRAR na lista (nunca ler); repetir o e-mail só atualiza nome e WhatsApp
create or replace function public.lista_espera_entrar(p_curso text, p_nome text, p_whatsapp text, p_email text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if length(trim(coalesce(p_nome, ''))) < 3 or length(regexp_replace(coalesce(p_whatsapp, ''), '[^0-9]', '', 'g')) < 10
     or coalesce(p_email, '') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'dados inválidos';
  end if;
  insert into public.curso_lista_espera (curso, nome, email, whatsapp)
  values (coalesce(nullif(trim(p_curso), ''), 'fundamentos'), trim(p_nome), lower(trim(p_email)), trim(p_whatsapp))
  on conflict (curso, lower(email)) do update set nome = excluded.nome, whatsapp = excluded.whatsapp;
end $$;
grant execute on function public.lista_espera_entrar(text, text, text, text) to anon, authenticated;
