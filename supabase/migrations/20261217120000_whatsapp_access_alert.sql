-- Entrega pelo botão "Receber meu acesso" (docs/whatsapp.md, fase 2): se 30 minutos depois do aviso de pagamento o
-- pedido continua só pago (ninguém tocou no botão, ou o aviso nem saiu), o Jota recebe um aviso no sininho e no
-- celular para entregar à mão pelo card de Pedidos. Roda pelo pg_cron a cada 5 minutos.

alter table public.whatsapp_messages add column alerted_at timestamptz;

create index whatsapp_messages_pending_access_idx on public.whatsapp_messages (created_at)
  where kind = 'payment_confirmed' and alerted_at is null;

/**
 * Dois avisos, uma vez por pedido: o aviso de pagamento saiu e ninguém pediu o acesso em 30 minutos; ou o aviso nem
 * saiu (ficou na fila porque a chamada da função falhou, ou a Meta recusou). Devolve quantos saíram.
 * Sem grant: só o pg_cron (ou o SQL Editor) chama.
 */
create or replace function public.whatsapp_alert_pending_access()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  alerted integer;
begin
  with pending as (
    update public.whatsapp_messages m
    set alerted_at = now()
    from public.orders o
    where o.id = m.order_id
      and m.kind = 'payment_confirmed'
      and m.status in ('queued', 'sending', 'sent', 'failed')
      and m.alerted_at is null
      and coalesce(m.sent_at, m.created_at) < now() - interval '30 minutes'
      and o.status = 'paid'
    returning m.status, o.code, o.cart_code, o.customer_name, o.account_handle
  )
  insert into public.notifications (kind, title, body, link)
  select
    'whatsapp',
    left(case when p.status = 'sent' then 'Acesso não pedido: ' else 'Aviso de pagamento não saiu: ' end || coalesce(p.cart_code, p.code), 120),
    left(case
      when p.status = 'sent' then split_part(p.customer_name, ' ', 1) || ' não tocou em "Receber meu acesso" de ' || p.account_handle
      else 'O WhatsApp não mandou o aviso de pagamento de ' || split_part(p.customer_name, ' ', 1) || ' (' || p.account_handle || ')'
    end || '. Entregue pelo card de Pedidos.', 500),
    '/admin/pedidos'
  from pending p;
  get diagnostics alerted = row_count;
  return alerted;
end;
$$;

revoke all on function public.whatsapp_alert_pending_access() from public, anon, authenticated;

-- Com o pg_cron ligado (Database > Extensions), agenda já; sem ele, agendar depois (docs/whatsapp.md).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('whatsapp-acesso-pendente', '*/5 * * * *', 'select public.whatsapp_alert_pending_access()');
  end if;
end;
$$;
