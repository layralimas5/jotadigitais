-- Carrinho: o cliente junta várias contas e paga tudo de uma vez.
-- Cada conta continua sendo um pedido (painel, entrega, garantia e financeiro seguem iguais). O carrinho amarra os
-- pedidos pelo `cart_code`, que é o código do pedido principal (a conta mais cara). Só o principal recebe as cobranças,
-- o aceite dos termos e o uso do cupom; quando ele é pago ou cancelado esperando pagamento, os outros acompanham.
-- O checkout de uma conta só segue pela place_order de sempre.

alter table public.orders add column cart_code text;

create index orders_cart_code_idx on public.orders (cart_code) where cart_code is not null;

-- Contas por carrinho: acima disso, o pedido é grande demais para uma reserva de 2 horas.
create or replace function public.cart_max_items()
returns integer
language sql
immutable
set search_path = ''
as $$ select 10 $$;

revoke all on function public.cart_max_items() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. Criação do pedido sabendo do carrinho
-- ---------------------------------------------------------------------------

/**
 * Mesma etapa interna do checkout_without_email, mais `p_cart_code`: com ele, o pedido nasce dentro daquele carrinho
 * e o limite de pedidos abertos não é conferido de novo (o principal já conferiu). O limite passa a contar carrinhos,
 * não contas: um carrinho de 5 contas é um pedido em aberto.
 */
create or replace function public.create_order(
  p_account_id uuid,
  p_name text,
  p_email text,
  p_whatsapp text,
  p_document text,
  p_birth_date date,
  p_instagram text,
  p_city text,
  p_state text,
  p_payment_method public.payment_method,
  p_hold_minutes integer,
  p_cart_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  acc public.accounts;
  new_order public.orders;
  clean_name text := btrim(coalesce(p_name, ''));
  clean_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  clean_whatsapp text := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
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
  if clean_whatsapp !~ '^\d{10,13}$' then
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
  if p_hold_minutes not between 15 and 1440 then
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

  if acc.status = 'sold'
     or (acc.status = 'reserved' and (acc.reserved_until is null or acc.reserved_until > now())) then
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
$$;

revoke all on function public.create_order(uuid, text, text, text, text, date, text, text, text, public.payment_method, integer, text)
  from public, anon, authenticated;

-- A versão de 11 argumentos (checkout de uma conta) vira "fora de carrinho".
create or replace function public.create_order(
  p_account_id uuid,
  p_name text,
  p_email text,
  p_whatsapp text,
  p_document text,
  p_birth_date date,
  p_instagram text,
  p_city text,
  p_state text,
  p_payment_method public.payment_method,
  p_hold_minutes integer default 120
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.create_order(
    p_account_id, p_name, p_email, p_whatsapp, p_document, p_birth_date, p_instagram, p_city, p_state,
    p_payment_method, p_hold_minutes, null::text
  );
$$;

revoke all on function public.create_order(uuid, text, text, text, text, date, text, text, text, public.payment_method, integer)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Página pública do pedido: as contas do carrinho, sem dado pessoal
-- ---------------------------------------------------------------------------

create or replace function public.public_order_json(o public.orders)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'code', o.code,
    'account_id', o.account_id,
    'account_handle', o.account_handle,
    'account_name', o.account_name,
    'account_platform', o.account_platform,
    'customer_name', split_part(o.customer_name, ' ', 1),
    'customer_email', public.mask_email(o.customer_email),
    'customer_whatsapp', null,
    'payment_method', o.payment_method,
    'total_cents', o.total_cents,
    'coupon_code', o.coupon_code,
    'discount_cents', o.discount_cents,
    'status', o.status,
    'expires_at', o.expires_at,
    'created_at', o.created_at,
    'cart_code', o.cart_code,
    -- Só o pedido principal lista o carrinho inteiro (ele mesmo primeiro).
    'cart_items', case when o.cart_code = o.code then coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', c.code,
        'account_handle', c.account_handle,
        'account_name', c.account_name,
        'account_platform', c.account_platform,
        'total_cents', c.total_cents,
        'discount_cents', c.discount_cents,
        'status', c.status
      ) order by c.code <> o.code, c.total_cents desc, c.code)
      from public.orders c where c.cart_code = o.code
    ), '[]'::jsonb) else '[]'::jsonb end,
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'position', p.position,
        'method', p.method,
        'amount_cents', p.amount_cents,
        'status', p.status,
        'checkout_url', p.checkout_url,
        'paid_at', p.paid_at,
        'requested_installments', p.requested_installments,
        'pix_code', case when p.status = 'pending' then p.pix_copy_paste end
      ) order by p.position)
      from public.order_payments p where p.order_id = o.id
    ), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. Pagou ou cancelou o principal: o carrinho inteiro acompanha
-- ---------------------------------------------------------------------------

create or replace function public.sync_cart_orders()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.cart_code = new.code and old.status = 'awaiting_payment' and new.status in ('paid', 'canceled') then
    update public.orders set status = new.status
      where cart_code = new.code and code <> new.code and status = 'awaiting_payment';
  end if;
  return null;
end;
$$;

revoke all on function public.sync_cart_orders() from public, anon, authenticated;

create trigger orders_sync_cart after update of status on public.orders
  for each row execute function public.sync_cart_orders();

-- ---------------------------------------------------------------------------
-- 4. Cupom no carrinho: o desconto vale sobre a soma das contas
-- ---------------------------------------------------------------------------

/** Contas distintas, existentes, entre 2 e o máximo do carrinho. Erro: invalid_cart. */
create or replace function public.clean_cart_ids(p_account_ids uuid[])
returns uuid[]
language plpgsql
stable
set search_path = ''
as $$
declare
  ids uuid[];
begin
  select array_agg(distinct id) into ids from unnest(coalesce(p_account_ids, '{}'::uuid[])) as id where id is not null;
  if ids is null
     or cardinality(ids) <> cardinality(p_account_ids)
     or cardinality(ids) not between 2 and public.cart_max_items() then
    raise exception 'invalid_cart' using errcode = 'P0001';
  end if;
  return ids;
end;
$$;

revoke all on function public.clean_cart_ids(uuid[]) from public, anon, authenticated;

create or replace function public.preview_cart_coupon(p_code text, p_account_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ids uuid[];
  subtotal integer;
  available integer;
  applied record;
begin
  if not public.rate_limit_allows(public.rate_limit_key('coupon', 'cart'), 'os cupons do checkout', 20, interval '1 hour') then
    return jsonb_build_object('error', 'too_many_attempts');
  end if;
  begin
    ids := public.clean_cart_ids(p_account_ids);
  exception when sqlstate 'P0001' then
    return jsonb_build_object('error', 'account_unavailable');
  end;
  select coalesce(sum(a.price_cents), 0), count(*) into subtotal, available
    from public.accounts a where a.id = any(ids) and a.status = 'available';
  if available <> cardinality(ids) then
    return jsonb_build_object('error', 'account_unavailable');
  end if;
  begin
    select * into applied from public.coupon_discount(p_code, subtotal, false);
  exception when sqlstate 'P0001' then
    return jsonb_build_object('error', sqlerrm);
  end;
  return jsonb_build_object(
    'code', applied.coupon_code,
    'discount_cents', applied.discount_cents,
    'total_cents', subtotal - applied.discount_cents
  );
end;
$$;

revoke all on function public.preview_cart_coupon(text, uuid[]) from public;
grant execute on function public.preview_cart_coupon(text, uuid[]) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Checkout do carrinho
-- ---------------------------------------------------------------------------

/**
 * Reserva todas as contas numa transação só: se uma já foi reservada ou vendida, nada fica reservado.
 * Mesmas conferências do checkout de uma conta (termos, limites, origem, divisão, parcelas, cupom).
 * Devolve o pedido principal, que é onde o cliente paga.
 */
create or replace function public.place_cart_order(
  p_account_ids uuid[],
  p_name text,
  p_whatsapp text,
  p_document text,
  p_payment_method public.payment_method,
  p_terms_version text,
  p_terms_sha256 text,
  p_privacy_version text,
  p_privacy_sha256 text,
  p_source text,
  p_referred_by text,
  p_first_part_cents integer,
  p_installments integer,
  p_coupon_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ids uuid[] := public.clean_cart_ids(p_account_ids);
  client_ip text := left(public.request_ip(), 64);
  client_agent text := left(public.request_header('user-agent'), 400);
  open_from_ip integer;
  clean_source public.lead_source;
  clean_referred_by text := nullif(regexp_replace(btrim(coalesce(p_referred_by, '')), '\s+', ' ', 'g'), '');
  min_part constant integer := 500;
  split boolean := p_payment_method::text in ('two_cards', 'card_pix');
  lead_code text;
  lead_order public.orders;
  item record;
  subtotal integer;
  total integer;
  share integer;
  remaining integer;
  applied record;
begin
  if not public.is_current_legal_document('terms', p_terms_version, p_terms_sha256)
     or not public.is_current_legal_document('privacy', p_privacy_version, p_privacy_sha256) then
    raise exception 'outdated_legal_documents' using errcode = 'P0001';
  end if;

  if p_source is null or p_source not in (select unnest(enum_range(null::public.lead_source))::text) then
    raise exception 'invalid_source' using errcode = 'P0001';
  end if;
  clean_source := p_source::public.lead_source;
  if clean_source <> 'referral' then
    clean_referred_by := null;
  elsif clean_referred_by is null or char_length(clean_referred_by) not between 2 and 80 then
    raise exception 'invalid_referred_by' using errcode = 'P0001';
  end if;

  if not split and p_first_part_cents is not null then
    raise exception 'invalid_split' using errcode = 'P0001';
  end if;
  if p_installments is not null and (p_payment_method::text <> 'card' or p_installments not between 1 and 12) then
    raise exception 'invalid_installments' using errcode = 'P0001';
  end if;

  -- Mesmos freios do checkout de uma conta; o carrinho conta como um pedido.
  if client_ip is not null then
    select count(*) into open_from_ip
      from public.orders o join public.consent_records r on r.order_id = o.id and r.document_slug = 'terms'
      where r.ip_address = client_ip and o.status = 'awaiting_payment' and o.expires_at > now();
    if open_from_ip >= 3 then
      raise exception 'too_many_open_orders' using errcode = 'P0001';
    end if;
  end if;
  if not public.rate_limit_allows(public.rate_limit_key('checkout', ''), 'o checkout', 10, interval '1 hour') then
    raise exception 'too_many_attempts' using errcode = 'P0001';
  end if;

  if (select count(*) from public.accounts a where a.id = any(ids)) <> cardinality(ids) then
    raise exception 'account_not_found' using errcode = 'P0001';
  end if;
  -- Trava todas na mesma ordem antes de reservar: dois carrinhos com contas em comum não se travam um ao outro.
  perform 1 from public.accounts a where a.id = any(ids) order by a.id for update;

  -- A conta mais cara é a principal: ela carrega o arredondamento do cupom sem chegar perto de zero.
  for item in select a.id from public.accounts a where a.id = any(ids) order by a.price_cents desc, a.id loop
    if lead_code is null then
      lead_code := public.create_order(
        item.id, p_name, null, p_whatsapp, p_document, null, null, null, null,
        p_payment_method, public.checkout_hold_minutes(), null::text
      ) ->> 'code';
      update public.orders set cart_code = lead_code where code = lead_code;
    else
      perform public.create_order(
        item.id, p_name, null, p_whatsapp, p_document, null, null, null, null,
        p_payment_method, public.checkout_hold_minutes(), lead_code
      );
    end if;
  end loop;

  update public.orders
    set customer_source = clean_source, customer_referred_by = clean_referred_by
    where cart_code = lead_code;

  select sum(o.total_cents)::integer into subtotal from public.orders o where o.cart_code = lead_code;
  total := subtotal;

  -- Cupom: conferido uma vez sobre a soma. O desconto é repartido pelo preço de cada conta (o financeiro fica certo
  -- por conta) e o uso conta uma vez só, no pedido principal.
  if nullif(btrim(coalesce(p_coupon_code, '')), '') is not null then
    select * into applied from public.coupon_discount(p_coupon_code, subtotal, true);
    remaining := applied.discount_cents;
    for item in select o.code, o.total_cents from public.orders o where o.cart_code = lead_code and o.code <> lead_code loop
      share := floor(item.total_cents::numeric * applied.discount_cents / subtotal)::integer;
      update public.orders
        set coupon_code = applied.coupon_code, discount_cents = share, total_cents = total_cents - share
        where code = item.code;
      remaining := remaining - share;
    end loop;
    update public.orders
      set coupon_id = applied.coupon_id, coupon_code = applied.coupon_code,
          discount_cents = remaining, total_cents = total_cents - remaining
      where code = lead_code;
    total := subtotal - applied.discount_cents;
  end if;

  if split and (p_first_part_cents is null or p_first_part_cents < min_part or total - p_first_part_cents < min_part) then
    raise exception 'invalid_split' using errcode = 'P0001';
  end if;

  select * into lead_order from public.orders where code = lead_code;

  insert into public.order_payments (order_id, position, method, provider, amount_cents)
  select lead_order.id, part.position, part.method, case part.method when 'card' then 'infinitepay' else 'nubank' end, part.amount
  from (
    values
      (1, case when p_payment_method::text = 'pix' then 'pix' else 'card' end,
          case when split then p_first_part_cents else total end),
      (2, case when p_payment_method::text = 'two_cards' then 'card' else 'pix' end,
          total - coalesce(p_first_part_cents, 0))
  ) as part (position, method, amount)
  where part.position = 1 or split;

  if p_installments is not null then
    update public.order_payments set requested_installments = p_installments
      where order_id = lead_order.id and method = 'card';
  end if;

  insert into public.consent_records (order_id, document_slug, document_version, document_sha256, ip_address, user_agent)
  values
    (lead_order.id, 'terms', p_terms_version, p_terms_sha256, client_ip, client_agent),
    (lead_order.id, 'privacy', p_privacy_version, p_privacy_sha256, client_ip, client_agent);

  return public.public_order_json(lead_order);
end;
$$;

revoke all on function public.place_cart_order(uuid[], text, text, text, public.payment_method, text, text, text, text, text, text, integer, integer, text) from public;
grant execute on function public.place_cart_order(uuid[], text, text, text, public.payment_method, text, text, text, text, text, text, integer, integer, text) to anon, authenticated;
