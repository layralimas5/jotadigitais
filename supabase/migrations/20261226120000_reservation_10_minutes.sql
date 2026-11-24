-- Chamado "Tempo de compra": a reserva cai de 2 h para 10 minutos e o pedido vencido sem pagamento
-- é cancelado sozinho, devolvendo a conta para a vitrine (antes ficava em "Pendentes" até o Jota cancelar).

-- 1. Prazo que o checkout aplica.
create or replace function public.checkout_hold_minutes()
returns integer
language sql
immutable
set search_path = ''
as $$
  select 10;
$$;

revoke all on function public.checkout_hold_minutes() from public, anon, authenticated;

-- 2. create_order recusava menos de 15 minutos. Troca só esse limite em todas as versões no banco.
do $do$
declare
  fn record;
  body text;
begin
  for fn in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_order'
  loop
    body := pg_get_functiondef(fn.oid);
    if position('p_hold_minutes not between 15 and 1440' in body) > 0 then
      execute replace(body, 'p_hold_minutes not between 15 and 1440', 'p_hold_minutes not between 5 and 1440');
    end if;
  end loop;
end;
$do$;

-- 3. Lembrete de pagamento no WhatsApp: com 10 minutos de reserva, 15 sairia na hora do pedido.
alter table public.whatsapp_settings alter column reminder_minutes set default 5;
update public.whatsapp_settings set reminder_minutes = 5 where reminder_minutes > 5;

-- 4. Pedido vencido cai sozinho. Dois minutos de folga para o Pix pago no último segundo ser conferido
--    (a c6-pix confere a cada minuto). Membro de carrinho segue o principal; pedido com parte já paga
--    (cartão + Pix) fica para o Jota decidir.
create or replace function public.cancel_expired_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  total integer;
begin
  update public.orders o
    set status = 'canceled'
    where o.status = 'awaiting_payment'
      and o.expires_at < now() - interval '2 minutes'
      and (o.cart_code is null or o.cart_code = o.code)
      and not exists (select 1 from public.order_payments p where p.order_id = o.id and p.status = 'paid');
  get diagnostics total = row_count;
  return total;
end;
$$;

revoke all on function public.cancel_expired_orders() from public, anon, authenticated;

do $do$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('pedidos-vencidos', '* * * * *', 'select public.cancel_expired_orders()');
  end if;
end;
$do$;
