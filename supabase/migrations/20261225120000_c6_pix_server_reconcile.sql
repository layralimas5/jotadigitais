-- Conferência do Pix do C6 no servidor, a cada minuto.
--
-- Em 23/11 dois Pix pagos pelo QR do pedido ficaram "aguardando": o C6 concluiu a cobrança, mas o aviso
-- dele não confirmou o pedido e o cliente não voltou para a página. Agora o pg_cron chama a c6-pix
-- (action "reconcile") enquanto houver Pix do C6 pendente, sem depender do aviso nem de tela aberta.
--
-- Segredos no Vault (fora do git): c6_reconcile_url (…/functions/v1/c6-pix) e c6_reconcile_secret,
-- o mesmo valor do secret C6_RECONCILE_SECRET da função. Sem eles, a rodada só avisa no log.

create or replace function public.c6_pix_reconcile()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_url text;
  reconcile_secret text;
begin
  if not exists (
    select 1
    from public.order_payments p
    join public.orders o on o.id = p.order_id
    where p.method = 'pix'
      and p.provider = 'c6'
      and p.status = 'pending'
      and p.pix_txid is not null
      and o.status = 'awaiting_payment'
      and p.created_at >= now() - interval '3 hours'
  ) then
    return;
  end if;

  select decrypted_secret into target_url from vault.decrypted_secrets where name = 'c6_reconcile_url';
  select decrypted_secret into reconcile_secret from vault.decrypted_secrets where name = 'c6_reconcile_secret';
  if target_url is null or reconcile_secret is null then
    raise warning 'c6: c6_reconcile_url ou c6_reconcile_secret ausente no Vault; Pix pendente não conferido';
    return;
  end if;

  perform net.http_post(
    url := target_url,
    body := jsonb_build_object('action', 'reconcile'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-c6-reconcile-secret', reconcile_secret),
    timeout_milliseconds := 30000
  );
end;
$$;

revoke all on function public.c6_pix_reconcile() from public, anon, authenticated;

do $do$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('c6-pix-conferir', '* * * * *', 'select public.c6_pix_reconcile()');
  end if;
end;
$do$;
