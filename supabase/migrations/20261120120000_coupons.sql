-- Cupons de desconto: o Jota cria no painel (aba Cupons) e o cliente digita no checkout.
-- O desconto é calculado SEMPRE aqui no banco, com o preço da conta; o site só mostra a prévia.
-- Ele entra no total do pedido antes das cobranças nascerem, então Pix (C6) e cartão (InfinitePay) já cobram com desconto.

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  -- Sempre em maiúsculas, sem espaço: é o que o cliente digita.
  code text not null check (code ~ '^[A-Z0-9_-]{3,30}$'),
  kind text not null check (kind in ('percent', 'fixed')),
  -- percent: 1 a 90 (%); fixed: centavos, de R$ 1,00 a R$ 100.000,00.
  value integer not null check (
    (kind = 'percent' and value between 1 and 90) or (kind = 'fixed' and value between 100 and 10000000)
  ),
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  max_uses integer check (max_uses is null or max_uses between 1 and 100000),
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coupons_period check (starts_at is null or ends_at is null or ends_at > starts_at)
);

create unique index coupons_code_key on public.coupons (code);

create trigger coupons_touch before update on public.coupons
  for each row execute function public.touch_updated_at();

alter table public.orders
  add column coupon_id uuid references public.coupons (id) on delete set null,
  add column coupon_code text,
  add column discount_cents integer not null default 0 check (discount_cents >= 0);

create index orders_coupon_idx on public.orders (coupon_id) where coupon_id is not null;

-- Usos = pedidos com o cupom que não foram cancelados (cancelou, o uso volta).
create or replace function public.coupon_uses(c public.coupons)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.orders o where o.coupon_id = c.id and o.status <> 'canceled';
$$;

revoke all on function public.coupon_uses(public.coupons) from public, anon;
grant execute on function public.coupon_uses(public.coupons) to authenticated;

alter table public.coupons enable row level security;

-- Só o admin (o Jota): ajudante não recebe a área de cupons.
create policy "admins read coupons" on public.coupons for select to authenticated using ((select public.is_admin()));
create policy "admins insert coupons" on public.coupons for insert to authenticated with check ((select public.is_admin()));
create policy "admins update coupons" on public.coupons for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins delete coupons" on public.coupons for delete to authenticated using ((select public.is_admin()));

revoke all on public.coupons from anon;

create trigger audit_delete after delete on public.coupons for each row execute function public.audit_row_change();

-- Pedido nunca fica abaixo disso: é o mínimo de cada parte no pagamento dividido.
create or replace function public.coupon_min_total_cents()
returns integer
language sql
immutable
set search_path = ''
as $$ select 500 $$;

/**
 * Confere o cupom para um preço e devolve o desconto em centavos. Erros: coupon_not_found, coupon_inactive,
 * coupon_not_started, coupon_expired, coupon_exhausted. `p_lock` trava a linha para dois pedidos não passarem
 * do limite de usos ao mesmo tempo.
 */
create or replace function public.coupon_discount(
  p_code text,
  p_price_cents integer,
  p_lock boolean,
  out coupon_id uuid,
  out coupon_code text,
  out discount_cents integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_code text := upper(btrim(coalesce(p_code, '')));
  coupon public.coupons;
begin
  if p_lock then
    select * into coupon from public.coupons c where c.code = clean_code for update;
  else
    select * into coupon from public.coupons c where c.code = clean_code;
  end if;
  if coupon.id is null then
    raise exception 'coupon_not_found' using errcode = 'P0001';
  end if;
  if not coupon.active then
    raise exception 'coupon_inactive' using errcode = 'P0001';
  end if;
  if coupon.starts_at is not null and now() < coupon.starts_at then
    raise exception 'coupon_not_started' using errcode = 'P0001';
  end if;
  if coupon.ends_at is not null and now() >= coupon.ends_at then
    raise exception 'coupon_expired' using errcode = 'P0001';
  end if;
  if coupon.max_uses is not null and public.coupon_uses(coupon) >= coupon.max_uses then
    raise exception 'coupon_exhausted' using errcode = 'P0001';
  end if;

  discount_cents := case coupon.kind
    when 'percent' then round(p_price_cents * coupon.value / 100.0)::integer
    else coupon.value
  end;
  discount_cents := greatest(0, least(discount_cents, p_price_cents - public.coupon_min_total_cents()));
  coupon_id := coupon.id;
  coupon_code := coupon.code;
end;
$$;

revoke all on function public.coupon_discount(text, integer, boolean) from public, anon, authenticated;

/**
 * Prévia do checkout: quanto o cupom tira desta conta. Limitada por visitante para ninguém testar códigos em massa.
 * Cupom recusado volta como {"error": ...} em vez de exceção: a exceção desfaria a tentativa contada no limite.
 */
create or replace function public.preview_coupon(p_code text, p_account_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  price integer;
  applied record;
begin
  if not public.rate_limit_allows(public.rate_limit_key('coupon', p_account_id::text), 'os cupons do checkout', 20, interval '1 hour') then
    return jsonb_build_object('error', 'too_many_attempts');
  end if;
  select a.price_cents into price from public.accounts a where a.id = p_account_id and a.status = 'available';
  if price is null then
    return jsonb_build_object('error', 'account_unavailable');
  end if;
  begin
    select * into applied from public.coupon_discount(p_code, price, false);
  exception when sqlstate 'P0001' then
    return jsonb_build_object('error', sqlerrm);
  end;
  return jsonb_build_object(
    'code', applied.coupon_code,
    'discount_cents', applied.discount_cents,
    'total_cents', price - applied.discount_cents
  );
end;
$$;

revoke all on function public.preview_coupon(text, uuid) from public;
grant execute on function public.preview_coupon(text, uuid) to anon, authenticated;

/**
 * Pedido completo: a versão de 18 argumentos mais `p_installments` (parcelas do cartão) e `p_coupon_code` (cupom).
 * Nulos = sem parcelas escolhidas / sem cupom. São 20 argumentos para não ficar ambígua com a de 19 (parcelas),
 * e sem valor padrão para não ficar ambígua com a de 18. As duas antigas passam a chamar esta.
 */
create or replace function public.place_order(
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
  p_terms_version text,
  p_terms_sha256 text,
  p_privacy_version text,
  p_privacy_sha256 text,
  p_source text,
  p_referred_by text,
  p_first_part_cents integer,
  p_hold_minutes integer,
  p_installments integer,
  p_coupon_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  placed jsonb;
  placed_order public.orders;
  clean_source public.lead_source;
  clean_referred_by text := nullif(regexp_replace(btrim(coalesce(p_referred_by, '')), '\s+', ' ', 'g'), '');
  min_part constant integer := 500;
  split boolean := p_payment_method::text in ('two_cards', 'card_pix');
  applied record;
begin
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

  -- Parcelas só no cartão único, de 1 a 12.
  if p_installments is not null and (p_payment_method::text <> 'card' or p_installments not between 1 and 12) then
    raise exception 'invalid_installments' using errcode = 'P0001';
  end if;

  placed := public.place_order(
    p_account_id, p_name, p_email, p_whatsapp, p_document, p_birth_date, p_instagram, p_city, p_state,
    p_payment_method, p_terms_version, p_terms_sha256, p_privacy_version, p_privacy_sha256, p_hold_minutes
  );

  update public.orders
    set customer_source = clean_source, customer_referred_by = clean_referred_by
    where code = placed ->> 'code'
    returning * into placed_order;

  -- Cupom: conferido e travado aqui, com o total que veio do preço da conta.
  if nullif(btrim(coalesce(p_coupon_code, '')), '') is not null then
    select * into applied from public.coupon_discount(p_coupon_code, placed_order.total_cents, true);
    update public.orders
      set coupon_id = applied.coupon_id,
          coupon_code = applied.coupon_code,
          discount_cents = applied.discount_cents,
          total_cents = placed_order.total_cents - applied.discount_cents
      where id = placed_order.id
      returning * into placed_order;
  end if;

  -- A divisão é conferida com o total já gravado (o preço vem da conta, nunca do navegador).
  if split and (
    p_first_part_cents is null
    or p_first_part_cents < min_part
    or placed_order.total_cents - p_first_part_cents < min_part
  ) then
    raise exception 'invalid_split' using errcode = 'P0001';
  end if;

  insert into public.order_payments (order_id, position, method, provider, amount_cents)
  select placed_order.id, part.position, part.method, case part.method when 'card' then 'infinitepay' else 'nubank' end, part.amount
  from (
    values
      (1, case when p_payment_method::text = 'pix' then 'pix' else 'card' end,
          case when split then p_first_part_cents else placed_order.total_cents end),
      (2, case when p_payment_method::text = 'two_cards' then 'card' else 'pix' end,
          placed_order.total_cents - coalesce(p_first_part_cents, 0))
  ) as part (position, method, amount)
  where part.position = 1 or split;

  if p_installments is not null then
    update public.order_payments set requested_installments = p_installments
      where order_id = placed_order.id and method = 'card';
  end if;

  return public.public_order_json(placed_order);
end;
$$;

revoke all on function public.place_order(uuid, text, text, text, text, date, text, text, text, public.payment_method, text, text, text, text, text, text, integer, integer, integer, text) from public;
grant execute on function public.place_order(uuid, text, text, text, text, date, text, text, text, public.payment_method, text, text, text, text, text, text, integer, integer, integer, text) to anon, authenticated;

-- A versão de 18 argumentos (site em cache, parcelas do cartão) agora é só "sem cupom".
create or replace function public.place_order(
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
  p_terms_version text,
  p_terms_sha256 text,
  p_privacy_version text,
  p_privacy_sha256 text,
  p_source text,
  p_referred_by text,
  p_first_part_cents integer default null,
  p_hold_minutes integer default 120
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.place_order(
    p_account_id, p_name, p_email, p_whatsapp, p_document, p_birth_date, p_instagram, p_city, p_state,
    p_payment_method, p_terms_version, p_terms_sha256, p_privacy_version, p_privacy_sha256,
    p_source, p_referred_by, p_first_part_cents, p_hold_minutes, null::integer, null::text
  );
$$;

-- A página do pedido mostra o cupom e o desconto.
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
