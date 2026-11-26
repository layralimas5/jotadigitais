-- Pagamento depois da reserva. Em 26/11 a @top.sries.tv foi paga por duas pessoas: o link de cartão da
-- InfinitePay não vence, a reserva de 10 minutos venceu com a cliente ainda na tela do cartão e outra
-- pessoa reservou um minuto depois. No mesmo dia, outra cliente pagou o cartão 4 segundos depois do
-- cancelamento automático e pagou de novo num pedido novo.
--
-- 0. A reserva passa de 10 para 15 minutos (pedido do Jota em 26/11).
-- 1. A folga de 2 minutos também segura a conta no create_order (antes só o cron respeitava).
-- 2. Quem abre o pagamento no cartão fica com a conta por 30 minutos.
-- 3. Pagamento que cai em pedido cancelado: se a conta segue livre, o pedido volta a valer; se não,
--    vira "Pago sem conta, estornar" no painel, com aviso no sininho e no push.

-- ---------------------------------------------------------------------------
-- 0. Reserva de 15 minutos
-- ---------------------------------------------------------------------------

create or replace function public.checkout_hold_minutes()
returns integer
language sql
immutable
set search_path = ''
as $$
  select 15;
$$;

revoke all on function public.checkout_hold_minutes() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. Folga depois da reserva
-- ---------------------------------------------------------------------------

create or replace function public.checkout_grace_minutes()
returns integer
language sql
immutable
set search_path = ''
as $$
  select 2;
$$;

revoke all on function public.checkout_grace_minutes() from public, anon, authenticated;

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
      and o.expires_at < now() - make_interval(mins => public.checkout_grace_minutes())
      and (o.cart_code is null or o.cart_code = o.code)
      and not exists (select 1 from public.order_payments p where p.order_id = o.id and p.status = 'paid');
  get diagnostics total = row_count;
  return total;
end;
$$;

revoke all on function public.cancel_expired_orders() from public, anon, authenticated;

create or replace function public.create_order(p_account_id uuid, p_name text, p_email text, p_whatsapp text, p_document text, p_birth_date date, p_instagram text, p_city text, p_state text, p_payment_method payment_method, p_hold_minutes integer, p_cart_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  acc public.accounts;
  new_order public.orders;
  clean_name text := btrim(coalesce(p_name, ''));
  clean_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  -- Com "+" e DDI diferente de 55 é número de fora: guarda o "+". "+55..." vira o número do Brasil só com dígitos.
  clean_whatsapp text := case
    when btrim(coalesce(p_whatsapp, '')) like '+%' and regexp_replace(p_whatsapp, '\D', '', 'g') not like '55%'
      then '+' || regexp_replace(p_whatsapp, '\D', '', 'g')
    else regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g')
  end;
  clean_document text := regexp_replace(coalesce(p_document, ''), '\D', '', 'g');
  clean_instagram text := nullif(btrim(coalesce(p_instagram, '')), '');
  clean_city text := nullif(btrim(coalesce(p_city, '')), '');
  clean_state text := nullif(upper(btrim(coalesce(p_state, ''))), '');
  document_hash text;
  open_orders integer;
  attempt integer := 0;
begin
  if char_length(clean_name) < 3 or char_length(clean_name) > 120 then
    raise exception 'invalid_name' using errcode = 'P0001';
  end if;
  if clean_email is not null and (clean_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(clean_email) > 254) then
    raise exception 'invalid_email' using errcode = 'P0001';
  end if;
  if clean_whatsapp !~ '^(\d{10,13}|\+[1-9]\d{7,14})$' then
    raise exception 'invalid_whatsapp' using errcode = 'P0001';
  end if;
  if not public.is_valid_document(clean_document) then
    raise exception 'invalid_document' using errcode = 'P0001';
  end if;
  if p_birth_date is not null and (p_birth_date < date '1900-01-01' or p_birth_date > (current_date - interval '18 years')::date) then
    raise exception 'invalid_birth_date' using errcode = 'P0001';
  end if;
  if clean_instagram is not null and left(clean_instagram, 1) <> '@' then
    clean_instagram := '@' || clean_instagram;
  end if;
  if clean_instagram is not null and clean_instagram !~ '^@[A-Za-z0-9._]{1,30}$' then
    raise exception 'invalid_instagram' using errcode = 'P0001';
  end if;
  if clean_city is not null and char_length(clean_city) not between 2 and 60 then
    raise exception 'invalid_city' using errcode = 'P0001';
  end if;
  if clean_state is not null and clean_state not in (
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
    'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ) then
    raise exception 'invalid_state' using errcode = 'P0001';
  end if;
  if p_hold_minutes not between 5 and 1440 then
    raise exception 'invalid_hold' using errcode = 'P0001';
  end if;

  document_hash := public.hash_pii(clean_document);
  if p_cart_code is null then
    select count(distinct coalesce(o.cart_code, o.code)) into open_orders from public.orders o
      where o.status = 'awaiting_payment' and o.expires_at > now()
        and (o.customer_email = clean_email or o.customer_whatsapp = clean_whatsapp or o.customer_document_hash = document_hash);
    if open_orders >= 2 then
      raise exception 'too_many_open_orders' using errcode = 'P0001';
    end if;
  end if;

  select * into acc from public.accounts where id = p_account_id for update;
  if not found then
    raise exception 'account_not_found' using errcode = 'P0001';
  end if;

  -- A conta segue presa durante a folga depois da reserva: o pagamento feito no último minuto ainda é
  -- conferido (cron pedidos-vencidos) antes de outra pessoa conseguir reservar.
  if acc.status = 'sold'
     or (acc.status = 'reserved' and (acc.reserved_until is null or acc.reserved_until > now()))
     or exists (
       select 1 from public.orders o
       where o.account_id = acc.id and o.status = 'awaiting_payment'
         and o.expires_at > now() - make_interval(mins => public.checkout_grace_minutes())
     ) then
    raise exception 'account_unavailable' using errcode = 'P0001';
  end if;

  update public.orders set status = 'canceled'
    where account_id = acc.id and status = 'awaiting_payment';

  loop
    attempt := attempt + 1;
    begin
      insert into public.orders (
        code, account_id, account_handle, account_name, account_platform,
        customer_name, customer_email, customer_whatsapp,
        customer_document, customer_birth_date, customer_instagram, customer_city, customer_state,
        payment_method, total_cents, expires_at, cart_code
      ) values (
        public.generate_order_code(), acc.id, acc.handle, acc.display_name, acc.platform,
        clean_name, clean_email, clean_whatsapp,
        clean_document, p_birth_date, clean_instagram, clean_city, clean_state,
        p_payment_method, acc.price_cents, now() + make_interval(mins => p_hold_minutes), p_cart_code
      ) returning * into new_order;
      exit;
    exception when unique_violation then
      if attempt >= 5 then
        raise;
      end if;
    end;
  end loop;

  update public.accounts
    set status = 'reserved', reserved_until = new_order.expires_at
    where id = acc.id;

  return public.public_order_json(new_order);
end;
$function$;

-- ---------------------------------------------------------------------------
-- 2. Cartão aberto segura a conta por mais tempo
-- ---------------------------------------------------------------------------

create or replace function public.checkout_card_hold_minutes()
returns integer
language sql
immutable
set search_path = ''
as $$
  select 30;
$$;

revoke all on function public.checkout_card_hold_minutes() from public, anon, authenticated;

-- Chamada pela função infinitepay quando o cliente vai para a tela do cartão. Estende o pedido (e o
-- carrinho inteiro, que paga junto no principal) e a reserva das contas. Devolve o novo prazo, ou nulo
-- quando o pedido não está mais esperando pagamento.
create or replace function public.extend_card_hold(p_payment_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  part public.order_payments;
  lead_order public.orders;
  new_expiry timestamptz := now() + make_interval(mins => public.checkout_card_hold_minutes());
begin
  select * into part from public.order_payments where id = p_payment_id;
  if not found or part.method <> 'card' or part.status <> 'pending' then
    return null;
  end if;

  select * into lead_order from public.orders where id = part.order_id for update;
  if lead_order.status <> 'awaiting_payment' or lead_order.expires_at <= now() then
    return null;
  end if;
  if lead_order.expires_at >= new_expiry then
    return lead_order.expires_at;
  end if;

  update public.orders o
    set expires_at = new_expiry
    where o.status = 'awaiting_payment'
      and (o.id = lead_order.id or (lead_order.cart_code is not null and o.cart_code = lead_order.cart_code));

  update public.accounts a
    set reserved_until = new_expiry
    where a.status = 'reserved'
      and a.id in (
        select o.account_id from public.orders o
        where o.status = 'awaiting_payment'
          and (o.id = lead_order.id or (lead_order.cart_code is not null and o.cart_code = lead_order.cart_code))
      );

  return new_expiry;
end;
$$;

revoke all on function public.extend_card_hold(uuid) from public, anon, authenticated;
grant execute on function public.extend_card_hold(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Pagamento que cai em pedido cancelado
-- ---------------------------------------------------------------------------

-- Quando o Jota marca que já devolveu o dinheiro (ou resolveu com o cliente).
alter table public.orders add column if not exists refunded_at timestamptz;

-- Pix do C6 que chega depois do cancelamento também é gravado: o dinheiro entrou e precisa aparecer.
create or replace function public.confirm_c6_pix_payment(p_payment_id uuid, p_txid text, p_end_to_end_id text, p_paid_amount_cents integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  part public.order_payments;
begin
  select * into part from public.order_payments where id = p_payment_id for update;
  if not found or part.method <> 'pix' or part.pix_txid is distinct from p_txid then
    return false;
  end if;
  if part.status = 'paid' then
    return true;
  end if;
  if part.status not in ('pending', 'canceled') or p_paid_amount_cents is null or p_paid_amount_cents < part.amount_cents then
    return false;
  end if;
  update public.order_payments
    set status = 'paid',
        provider = 'c6',
        pix_end_to_end_id = left(p_end_to_end_id, 64),
        paid_amount_cents = p_paid_amount_cents
    where id = part.id;
  return true;
end;
$$;

revoke all on function public.confirm_c6_pix_payment(uuid, text, text, integer) from public, anon, authenticated;

-- Cancelado só volta para pago pelo gatilho de pagamento atrasado (flag da transação), nunca pelo painel.
create or replace function public.sync_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed boolean;
  other_active boolean;
begin
  if new.status = old.status then
    return new;
  end if;

  allowed := case old.status
    when 'awaiting_payment' then new.status in ('paid', 'canceled')
    when 'paid' then new.status in ('delivered', 'canceled')
    when 'canceled' then new.status = 'paid' and coalesce(current_setting('jota.late_payment', true), '') = 'on'
    else false
  end;
  if not allowed then
    raise exception 'invalid_transition: % -> %', old.status, new.status using errcode = 'P0001';
  end if;

  if new.status = 'delivered' then
    new.delivered_at := now();
  end if;

  if new.account_id is null then
    return new;
  end if;

  if new.status = 'paid' then
    update public.accounts set status = 'reserved', reserved_until = null where id = new.account_id;
  elsif new.status = 'delivered' then
    update public.accounts set status = 'sold', reserved_until = null where id = new.account_id;
  elsif new.status = 'canceled' then
    select exists (
      select 1 from public.orders o
      where o.account_id = new.account_id
        and o.id <> new.id
        and (o.status in ('paid', 'delivered') or (o.status = 'awaiting_payment' and o.expires_at > now()))
    ) into other_active;
    if not other_active then
      update public.accounts set status = 'available', reserved_until = null
        where id = new.account_id and status = 'reserved';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.handle_late_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  late_order public.orders;
  account_free boolean;
  paid_label text;
begin
  select * into late_order from public.orders where id = new.order_id for update;
  if not found or late_order.status <> 'canceled' then
    return null;
  end if;

  paid_label := 'R$ ' || replace(to_char(coalesce(new.paid_amount_cents, new.amount_cents) / 100.0, 'FM999999990.00'), '.', ',')
    || case when new.method = 'card' then ' no cartão' else ' no Pix' end;

  -- Carrinho e pagamento dividido com parte em aberto ficam para o Jota decidir.
  account_free := late_order.cart_code is null
    and late_order.account_id is not null
    and not exists (select 1 from public.order_payments p where p.order_id = late_order.id and p.status <> 'paid')
    and exists (select 1 from public.accounts a where a.id = late_order.account_id and a.status = 'available')
    and not exists (
      select 1 from public.orders o
      where o.account_id = late_order.account_id
        and o.id <> late_order.id
        and (o.status in ('paid', 'delivered')
          or (o.status = 'awaiting_payment' and o.expires_at > now() - make_interval(mins => public.checkout_grace_minutes())))
    );

  if account_free then
    perform set_config('jota.late_payment', 'on', true);
    update public.orders set status = 'paid' where id = late_order.id;
    perform set_config('jota.late_payment', 'off', true);
    update public.affiliate_commissions
      set status = 'pending', canceled_reason = null
      where order_id = late_order.id and status = 'canceled' and canceled_reason = 'order_canceled';
    insert into public.notifications (kind, title, body, link)
    values (
      'payment',
      'Pagamento atrasado confirmado ' || late_order.code,
      late_order.customer_name || ' pagou ' || paid_label || ' depois que a reserva venceu. A conta '
        || late_order.account_handle || ' ainda estava livre e ficou com ela. Falta entregar.',
      '/admin/pedidos'
    );
  else
    insert into public.notifications (kind, title, body, link)
    values (
      'payment',
      'Pago sem conta: estornar ' || late_order.code,
      late_order.customer_name || ' pagou ' || paid_label || ' depois que o pedido foi cancelado, e a conta '
        || late_order.account_handle || ' não está mais livre. Estorne ou ofereça outra conta.',
      '/admin/pedidos'
    );
  end if;
  return null;
end;
$$;

revoke all on function public.handle_late_payment() from public, anon, authenticated;

drop trigger if exists order_payments_late on public.order_payments;
create trigger order_payments_late after update of status on public.order_payments
  for each row
  when (new.status = 'paid' and old.status is distinct from 'paid')
  execute function public.handle_late_payment();

-- "Já estornei" no painel.
create or replace function public.mark_order_refunded(p_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('orders') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.orders o
    set refunded_at = now()
    where o.code = upper(btrim(coalesce(p_code, '')))
      and o.status = 'canceled'
      and o.refunded_at is null
      and exists (select 1 from public.order_payments p where p.order_id = o.id and p.status = 'paid');
  if not found then
    raise exception 'refund_not_needed' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.mark_order_refunded(text) from public, anon;
grant execute on function public.mark_order_refunded(text) to authenticated;

-- Testes de R$ 1 e R$ 5 do começo da loja não precisam de estorno.
update public.orders o
  set refunded_at = o.updated_at
  where o.status = 'canceled' and o.total_cents < 1000 and o.refunded_at is null
    and exists (select 1 from public.order_payments p where p.order_id = o.id and p.status = 'paid');
