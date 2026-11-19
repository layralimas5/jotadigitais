-- Aba WhatsApp > Relatório (docs/whatsapp.md, "Relatório"): números do atendimento e das vendas num período.
-- Tudo sai de tabelas que já existem; nada novo é gravado.

create index if not exists whatsapp_chat_created_idx on public.whatsapp_chat (created_at desc);

/**
 * Relatório dos últimos 7, 30 ou 90 dias. Só quem tem a área Automação.
 * Envios do modo teste contam junto (o painel avisa quando ainda é teste).
 */
create or replace function public.whatsapp_report(p_days integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  since timestamptz;
  result jsonb;
begin
  if not public.has_permission('automation') then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if p_days is null or p_days not in (7, 30, 90) then
    raise exception 'invalid_period' using errcode = 'P0001';
  end if;
  since := now() - make_interval(days => p_days);

  with period_chat as (
    select contact_id, direction, author from public.whatsapp_chat where created_at >= since
  ),
  active as (select distinct contact_id from period_chat where direction = 'in'),
  staff_touched as (select distinct contact_id from period_chat where author = 'staff'),
  sent_messages as (
    select m.kind, o.status as order_status
    from public.whatsapp_messages m
    left join public.orders o on o.id = m.order_id
    where m.created_at >= since and m.status in ('sent', 'test')
  ),
  chat_sales as (
    select o.total_cents
    from public.orders o
    where o.created_at >= since
      and o.status in ('paid', 'delivered')
      and o.customer_whatsapp is not null
      and exists (
        select 1 from public.whatsapp_contacts c
        where c.created_at < o.created_at
          and public.whatsapp_phone_key(c.phone) = public.whatsapp_phone_key(o.customer_whatsapp)
      )
  )
  select jsonb_build_object(
    'days', p_days,
    'conversations', (select count(*) from active),
    'new_contacts', (select count(*) from public.whatsapp_contacts where created_at >= since),
    'received', (select count(*) from period_chat where direction = 'in'),
    'ai_replies', (select count(*) from period_chat where author = 'ai'),
    'staff_replies', (select count(*) from period_chat where author = 'staff'),
    'ai_only', (
      select count(*) from active a
      join public.whatsapp_contacts c on c.id = a.contact_id
      where c.handler = 'ai' and not exists (select 1 from staff_touched s where s.contact_id = a.contact_id)
    ),
    'handoffs', (
      select count(*) from public.notifications
      where kind = 'whatsapp' and created_at >= since and title like '%está esperando você no WhatsApp'
    ),
    'waiting_now', (select count(*) from public.whatsapp_contacts where handler = 'staff' and unread_count > 0),
    'access_delivered', (select count(*) from sent_messages where kind = 'delivery'),
    'reminders_sent', (select count(*) from sent_messages where kind = 'payment_reminder'),
    'reminders_paid', (select count(*) from sent_messages where kind = 'payment_reminder' and order_status in ('paid', 'delivered')),
    'after_sales_sent', (select count(*) from sent_messages where kind = 'after_sale'),
    'chat_sales', (select count(*) from chat_sales),
    'chat_sales_cents', (select coalesce(sum(total_cents), 0) from chat_sales)
  ) into result;
  return result;
end;
$$;

revoke all on function public.whatsapp_report(integer) from public, anon;
grant execute on function public.whatsapp_report(integer) to authenticated;
