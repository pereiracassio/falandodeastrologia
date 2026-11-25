-- Aviso ao administrador quando o pagamento do carrinho não abre para o cliente.
create table if not exists public.pagamento_falhas (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  order_nsu text, nome text, whatsapp text, email text, servicos text, motivo text
);
alter table public.pagamento_falhas enable row level security;
drop policy if exists "visitante registra falha" on public.pagamento_falhas;
create policy "visitante registra falha" on public.pagamento_falhas for insert to anon, authenticated
  with check (length(coalesce(nome,'')) <= 200 and length(coalesce(servicos,'')) <= 600 and length(coalesce(motivo,'')) <= 400);
drop policy if exists "admin le falhas" on public.pagamento_falhas;
create policy "admin le falhas" on public.pagamento_falhas for select to authenticated using (public.sou_admin());
grant insert on public.pagamento_falhas to anon, authenticated;
grant select on public.pagamento_falhas to authenticated;
grant all on public.pagamento_falhas to service_role;

create or replace function public.trg_aviso_pagamento_falhou() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.avisar_admins('Pagamento não abriu',
    coalesce(nullif(trim(new.nome), ''), 'Um cliente') || ' não conseguiu abrir o pagamento (' || left(coalesce(new.servicos, ''), 100) || '). WhatsApp: ' || coalesce(new.whatsapp, '-') || '. Motivo: ' || left(coalesce(new.motivo, '-'), 120),
    '/admin-checkouts.html');
  return new;
end $$;
drop trigger if exists aviso_pagamento_falhou on public.pagamento_falhas;
create trigger aviso_pagamento_falhou after insert on public.pagamento_falhas
  for each row execute function public.trg_aviso_pagamento_falhou();
