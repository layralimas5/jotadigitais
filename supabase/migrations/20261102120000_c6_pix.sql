-- Pix automático pelo C6 Bank.
-- 1. Cada parte Pix ganha uma cobrança imediata (cob) no C6, criada pela Edge Function c6-pix quando o cliente
--    abre o pedido. O código copia e cola vem do C6 e o txid é o id da parte sem hífens.
-- 2. O pagamento é confirmado pelo webhook do C6 e pela própria página do pedido, e nos dois casos a função
--    consulta a cobrança no C6 antes de marcar pago. Fica gravado o endToEndId do Pix (a prova do pagamento).
-- 3. Se o C6 não responder, a parte continua com o QR Code estático da chave Nubank e o Jota confirma no painel.

alter table public.order_payments drop constraint order_payments_provider_check;
alter table public.order_payments
  add constraint order_payments_provider_check check (provider in ('infinitepay', 'nubank', 'c6')),
  add column pix_txid text unique check (pix_txid is null or pix_txid ~ '^[a-zA-Z0-9]{26,35}$'),
  add column pix_copy_paste text check (pix_copy_paste is null or char_length(pix_copy_paste) <= 512),
  add column pix_end_to_end_id text unique check (pix_end_to_end_id is null or char_length(pix_end_to_end_id) <= 64);

-- O código copia e cola é público como o próprio QR Code: só aparece enquanto a parte espera pagamento.
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
        'requested_installments', p.requested_installments,
        'pix_code', case when p.status = 'pending' then p.pix_copy_paste end
      ) order by p.position)
      from public.order_payments p where p.order_id = o.id
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.public_order_json(public.orders) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Usado pela Edge Function c6-pix (chave de serviço): marca o Pix como pago depois de conferir
-- a cobrança no C6. Repetir o mesmo Pix não faz nada.
-- ---------------------------------------------------------------------------

create or replace function public.confirm_c6_pix_payment(
  p_payment_id uuid,
  p_txid text,
  p_end_to_end_id text,
  p_paid_amount_cents integer
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
  if not found or part.method <> 'pix' or part.pix_txid is distinct from p_txid then
    return false;
  end if;
  if part.status = 'paid' then
    return true;
  end if;
  if part.status <> 'pending' or p_paid_amount_cents is null or p_paid_amount_cents < part.amount_cents then
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
grant execute on function public.confirm_c6_pix_payment(uuid, text, text, integer) to service_role;
