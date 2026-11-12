-- Aviso lido em um aparelho: o banco manda os outros aparelhos fecharem a notificação (e acertarem o número do ícone)
create or replace function public.trg_fechar_aviso() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  begin
    perform net.http_post(
      url := 'https://wqkgsotfwkzjwaowenrb.supabase.co/functions/v1/quick-service',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := jsonb_build_object('fechar', new.id)
    );
  exception when others then
    null;
  end;
  return new;
end $$;
drop trigger if exists fechar_aviso on public.avisos_recebidos;
create trigger fechar_aviso after update of lido on public.avisos_recebidos
  for each row when (old.lido = false and new.lido = true) execute function public.trg_fechar_aviso();
