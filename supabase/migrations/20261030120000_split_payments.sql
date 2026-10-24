-- Pagamento em uma ou duas partes.
-- 1. Formas: Pix, cartão, dois cartões ou cartão + Pix. Cada parte vira uma cobrança em order_payments.
-- 2. Cartão é cobrado pela InfinitePay (link de checkout criado pela Edge Function infinitepay, confirmado
--    pelo webhook e pela consulta payment_check). Pix cai direto na conta Nubank do Jota: o Nubank PJ não
--    tem API, então o site mostra o QR Code com valor e o Jota confirma o recebimento no painel.
-- 3. Com todas as partes pagas, o pedido passa sozinho para "pago".

alter type public.payment_method add value if not exists 'two_cards';
alter type public.payment_method add value if not exists 'card_pix';

-- ---------------------------------------------------------------------------
-- Dados do Pix (aparecem para o cliente no QR Code)
-- ---------------------------------------------------------------------------

alter table public.store_settings
  add column pix_key text check (pix_key is null or char_length(pix_key) between 1 and 77),
  add column pix_receiver_name text check (pix_receiver_name is null or char_length(pix_receiver_name) between 2 and 25),
  add column pix_receiver_city text check (pix_receiver_city is null or char_length(pix_receiver_city) between 2 and 15);

-- ---------------------------------------------------------------------------
-- Cobranças do pedido
-- ---------------------------------------------------------------------------

create table public.order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  position smallint not null check (position between 1 and 2),
  method text not null check (method in ('pix', 'card')),
  provider text not null check (provider in ('infinitepay', 'nubank')),
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'canceled')),
  checkout_url text check (checkout_url is null or checkout_url ~ '^https://'),
  provider_slug text,
  transaction_nsu text unique,
  installments smallint,
  paid_amount_cents integer,
  receipt_url text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, position),
  check ((method = 'card') = (provider = 'infinitepay'))
);

create index order_payments_order_idx on public.order_payments (order_id);

create trigger order_payments_touch before update on public.order_payments
  for each row execute function public.touch_updated_at();

alter table public.order_payments enable row level security;

create policy "admins read order payments" on public.order_payments
  for select to authenticated using ((select public.is_admin()));

-- O Jota confirma o Pix recebido no painel. O cartão é confirmado pela Edge Function (chave de serviço).
create policy "admins update order payments" on public.order_payments
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

revoke all on public.order_payments from anon;
revoke insert, delete on public.order_payments from authenticated;

-- Parte paga ganha a data; com todas pagas, o pedido que esperava pagamento vira "pago".
create or replace function public.settle_order_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'paid' and old.status <> 'paid' then
    new.paid_at := coalesce(new.paid_at, now());
  end if;
  if new.status <> 'paid' then
    new.paid_at := null;
  end if;
  return new;
end;
$$;

create trigger order_payments_settle before update of status on public.order_payments
  for each row execute function public.settle_order_payment();

create or replace function public.complete_paid_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'paid' and not exists (
    select 1 from public.order_payments where order_id = new.order_id and status <> 'paid'
  ) then
    update public.orders set status = 'paid' where id = new.order_id and status = 'awaiting_payment';
  end if;
  return null;
end;
$$;

create trigger order_payments_complete after update of status on public.order_payments
  for each row execute function public.complete_paid_order();

-- Pedido cancelado não cobra mais nada em aberto. Pedido marcado como pago à mão em Pedidos
-- (o Jota conferiu tudo) dá as partes em aberto como pagas.
create or replace function public.sync_payments_with_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'canceled' and old.status <> 'canceled' then
    update public.order_payments set status = 'canceled' where order_id = new.id and status = 'pending';
  elsif new.status = 'paid' and old.status = 'awaiting_payment' then
    update public.order_payments set status = 'paid' where order_id = new.id and status = 'pending';
  end if;
  return null;
end;
$$;

create trigger orders_sync_payments after update of status on public.orders
  for each row execute function public.sync_payments_with_order();

revoke all on function public.settle_order_payment() from public, anon, authenticated;
revoke all on function public.complete_paid_order() from public, anon, authenticated;
revoke all on function public.sync_payments_with_order() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Página pública do pedido: as cobranças, sem dado pessoal
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
        'paid_at', p.paid_at
      ) order by p.position)
      from public.order_payments p where p.order_id = o.id
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.public_order_json(public.orders) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Checkout com a forma de pagamento dividida
-- ---------------------------------------------------------------------------

-- A versão com a origem (20261029120000) nunca foi ao ar sem esta: sai para não sobrar caminho sem cobranças.
drop function if exists public.place_order(uuid, text, text, text, text, date, text, text, text, public.payment_method, text, text, text, text, text, text, integer);

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

  placed := public.place_order(
    p_account_id, p_name, p_email, p_whatsapp, p_document, p_birth_date, p_instagram, p_city, p_state,
    p_payment_method, p_terms_version, p_terms_sha256, p_privacy_version, p_privacy_sha256, p_hold_minutes
  );

  update public.orders
    set customer_source = clean_source, customer_referred_by = clean_referred_by
    where code = placed ->> 'code'
    returning * into placed_order;

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

  return public.public_order_json(placed_order);
end;
$$;

revoke all on function public.place_order(uuid, text, text, text, text, date, text, text, text, public.payment_method, text, text, text, text, text, text, integer, integer) from public;
grant execute on function public.place_order(uuid, text, text, text, text, date, text, text, text, public.payment_method, text, text, text, text, text, text, integer, integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Usado pela Edge Function infinitepay (chave de serviço): marca o cartão como pago
-- depois de conferir na InfinitePay. Repetir a mesma transação não faz nada.
-- ---------------------------------------------------------------------------

create or replace function public.confirm_card_payment(
  p_payment_id uuid,
  p_transaction_nsu text,
  p_slug text,
  p_paid_amount_cents integer,
  p_installments integer,
  p_receipt_url text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  part public.order_payments;
begin
  select * into part from public.order_payments where id = p_payment_id for update;
  if not found or part.method <> 'card' then
    return false;
  end if;
  if part.status = 'paid' then
    return true;
  end if;
  if p_paid_amount_cents is null or p_paid_amount_cents < part.amount_cents then
    return false;
  end if;
  update public.order_payments
    set status = 'paid',
        transaction_nsu = p_transaction_nsu,
        provider_slug = p_slug,
        paid_amount_cents = p_paid_amount_cents,
        installments = p_installments,
        receipt_url = case when p_receipt_url ~ '^https://' then left(p_receipt_url, 500) end
    where id = part.id;
  return true;
end;
$$;

revoke all on function public.confirm_card_payment(uuid, text, text, integer, integer, text) from public, anon, authenticated;
grant execute on function public.confirm_card_payment(uuid, text, text, integer, integer, text) to service_role;
