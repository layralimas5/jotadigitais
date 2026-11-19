-- Lembrete de pedido não pago e pós-venda pelo WhatsApp (docs/whatsapp.md, "Lembrete e pós-venda").
-- O pg_cron chama whatsapp_queue_followups a cada 5 minutos: ela põe na fila e chama a whatsapp-send, que manda o
-- modelo aprovado (ou texto livre, se a conversa estiver aberta) ou, no modo teste, só registra. Os dois começam
-- desligados: o Jota liga na aba WhatsApp > Entrega automática.

-- ---------------------------------------------------------------------------
-- 1. Configuração
-- ---------------------------------------------------------------------------

alter table public.whatsapp_settings
  add column payment_reminder boolean not null default false,
  -- Quantos minutos antes de a reserva vencer o lembrete sai.
  add column reminder_minutes integer not null default 15 check (reminder_minutes between 5 and 120),
  add column after_sale boolean not null default false,
  -- Quantos dias depois da entrega sai a mensagem de pós-venda.
  add column after_sale_days integer not null default 3 check (after_sale_days between 1 and 30);

grant update (payment_reminder, reminder_minutes, after_sale, after_sale_days) on public.whatsapp_settings to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Tipos e situação novos no registro
-- ---------------------------------------------------------------------------

alter table public.whatsapp_messages drop constraint whatsapp_messages_kind_check;
alter table public.whatsapp_messages add constraint whatsapp_messages_kind_check
  check (kind in ('payment_confirmed', 'delivery', 'payment_reminder', 'after_sale'));

-- canceled: na hora de sair, o lembrete não fazia mais sentido (pedido pago, cancelado ou vencido).
alter table public.whatsapp_messages drop constraint whatsapp_messages_status_check;
alter table public.whatsapp_messages add constraint whatsapp_messages_status_check
  check (status in ('queued', 'sending', 'test', 'sent', 'failed', 'canceled'));

create index whatsapp_messages_order_kind_idx on public.whatsapp_messages (order_id, kind);

-- ---------------------------------------------------------------------------
-- 3. Chamada da função de envio (a mesma do gatilho de pagamento)
-- ---------------------------------------------------------------------------

/** Chama a whatsapp-send para uma mensagem da fila. Sem os segredos no Vault, a mensagem só espera. */
create or replace function public.whatsapp_dispatch(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_url text;
  send_secret text;
begin
  select decrypted_secret into target_url from vault.decrypted_secrets where name = 'whatsapp_send_url';
  select decrypted_secret into send_secret from vault.decrypted_secrets where name = 'whatsapp_send_secret';
  if target_url is null or send_secret is null then
    raise warning 'whatsapp: whatsapp_send_url ou whatsapp_send_secret ausente no Vault; mensagem % ficou na fila', p_message_id;
    return;
  end if;
  perform net.http_post(
    url := target_url,
    body := jsonb_build_object('message_id', p_message_id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-whatsapp-secret', send_secret),
    timeout_milliseconds := 10000
  );
end;
$$;

revoke all on function public.whatsapp_dispatch(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. O que entra na fila a cada rodada
-- ---------------------------------------------------------------------------

/**
 * Lembrete: pedido esperando pagamento cuja reserva vence nos próximos `reminder_minutes`.
 * Pós-venda: pedido entregue há `after_sale_days` dias (só no dia seguinte a completar o prazo, sem atrasados antigos).
 * Um por pedido, só o principal do carrinho, nunca para quem escreveu "parar". Devolve quantos entraram.
 * Sem grant: só o pg_cron (ou o SQL Editor) chama.
 */
create or replace function public.whatsapp_queue_followups()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  settings public.whatsapp_settings;
  queued uuid;
  total integer := 0;
begin
  select * into settings from public.whatsapp_settings;
  if settings is null then
    return 0;
  end if;

  for queued in
    insert into public.whatsapp_messages (order_id, kind, to_phone)
    select
      o.id,
      f.kind,
      case when o.customer_whatsapp like '55%' and char_length(o.customer_whatsapp) >= 12
        then o.customer_whatsapp else '55' || o.customer_whatsapp end
    from public.orders o
    cross join lateral (
      select 'payment_reminder'::text as kind
      where settings.payment_reminder
        and o.status = 'awaiting_payment'
        and o.expires_at > now()
        and o.expires_at <= now() + make_interval(mins => settings.reminder_minutes)
      union all
      select 'after_sale'
      where settings.after_sale
        and o.status = 'delivered'
        and o.delivered_at <= now() - make_interval(days => settings.after_sale_days)
        and o.delivered_at > now() - make_interval(days => settings.after_sale_days + 1)
    ) f
    where o.customer_whatsapp is not null
      and (o.cart_code is null or o.cart_code = o.code)
      and not exists (select 1 from public.whatsapp_messages m where m.order_id = o.id and m.kind = f.kind)
      and not exists (
        select 1 from public.whatsapp_contacts c
        where c.opted_out and public.whatsapp_phone_key(c.phone) = public.whatsapp_phone_key(o.customer_whatsapp)
      )
    returning id
  loop
    perform public.whatsapp_dispatch(queued);
    total := total + 1;
  end loop;
  return total;
end;
$$;

revoke all on function public.whatsapp_queue_followups() from public, anon, authenticated;

do $do$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('whatsapp-lembretes', '*/5 * * * *', 'select public.whatsapp_queue_followups()');
  end if;
end;
$do$;
