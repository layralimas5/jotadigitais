-- Como o cliente conheceu a loja e, se foi indicação, quem indicou.
-- 1. O checkout passa a perguntar a origem (obrigatória) e o nome de quem indicou.
--    Fica no pedido, junto com o resto da ficha; só administradores leem.
-- 2. O cadastro manual de cliente ganha o mesmo "quem indicou".
-- 3. O painel liga o nome digitado ao parceiro (nome, primeiro nome ou @) na hora de mostrar a aba Parceiros.

alter type public.lead_source add value if not exists 'youtube' before 'referral';
alter type public.lead_source add value if not exists 'google' before 'referral';

alter table public.orders
  add column customer_source public.lead_source,
  add column customer_referred_by text check (
    customer_referred_by is null or char_length(customer_referred_by) between 2 and 80
  );

alter table public.customers
  add column referred_by text check (referred_by is null or char_length(referred_by) between 2 and 80);

-- Nova versão do checkout com a origem. A anterior continua no ar para quem estiver com o site antigo
-- aberto durante a publicação; os nomes de parâmetro diferentes evitam ambiguidade no PostgREST.
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
  p_hold_minutes integer default 120
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  placed jsonb;
  clean_source public.lead_source;
  clean_referred_by text := nullif(regexp_replace(btrim(coalesce(p_referred_by, '')), '\s+', ' ', 'g'), '');
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

  placed := public.place_order(
    p_account_id, p_name, p_email, p_whatsapp, p_document, p_birth_date, p_instagram, p_city, p_state,
    p_payment_method, p_terms_version, p_terms_sha256, p_privacy_version, p_privacy_sha256, p_hold_minutes
  );

  update public.orders
    set customer_source = clean_source, customer_referred_by = clean_referred_by
    where code = placed ->> 'code';

  return placed;
end;
$$;

revoke all on function public.place_order(uuid, text, text, text, text, date, text, text, text, public.payment_method, text, text, text, text, text, text, integer) from public;
grant execute on function public.place_order(uuid, text, text, text, text, date, text, text, text, public.payment_method, text, text, text, text, text, text, integer) to anon, authenticated;
