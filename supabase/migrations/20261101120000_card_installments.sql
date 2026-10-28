-- Parcelas do cartão escolhidas no checkout.
-- A InfinitePay não aceita parcelas no link de pagamento (quem escolhe é o cliente, na tela dela). Por isso o
-- número fica gravado como o pedido do cliente: a página do pedido lembra qual escolher e o painel mostra ao Jota.
-- O place_order de 18 argumentos continua no ar para o site antigo; o novo, com p_installments, chama ele.

alter table public.order_payments
  add column requested_installments smallint check (requested_installments between 1 and 12);

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
        'paid_at', p.paid_at,
        'requested_installments', p.requested_installments
      ) order by p.position)
      from public.order_payments p where p.order_id = o.id
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.public_order_json(public.orders) from public, anon, authenticated;

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
  p_installments integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  placed jsonb;
  placed_order public.orders;
begin
  -- Parcelas só no cartão único; no cartão, a escolha é obrigatória.
  if (p_payment_method::text = 'card') <> (p_installments is not null) or p_installments not between 1 and 12 then
    raise exception 'invalid_installments' using errcode = 'P0001';
  end if;

  placed := public.place_order(
    p_account_id, p_name, p_email, p_whatsapp, p_document, p_birth_date, p_instagram, p_city, p_state,
    p_payment_method, p_terms_version, p_terms_sha256, p_privacy_version, p_privacy_sha256,
    p_source, p_referred_by, p_first_part_cents, p_hold_minutes
  );
  if p_installments is null then
    return placed;
  end if;

  select * into placed_order from public.orders where code = placed ->> 'code';
  update public.order_payments set requested_installments = p_installments
    where order_id = placed_order.id and method = 'card';
  return public.public_order_json(placed_order);
end;
$$;

revoke all on function public.place_order(uuid, text, text, text, text, date, text, text, text, public.payment_method, text, text, text, text, text, text, integer, integer, integer) from public;
grant execute on function public.place_order(uuid, text, text, text, text, date, text, text, text, public.payment_method, text, text, text, text, text, text, integer, integer, integer) to anon, authenticated;
