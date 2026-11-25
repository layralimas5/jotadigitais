-- Cliente de fora do Brasil no checkout: o WhatsApp é gravado com "+" e o código do país ("+351925812020").
-- Número do Brasil continua só com dígitos (com DDD, DDI 55 opcional). O "+" separa os dois.

alter table public.orders drop constraint orders_customer_whatsapp_check;
alter table public.orders add constraint orders_customer_whatsapp_check
  check (customer_whatsapp is null or customer_whatsapp ~ '^(\d{10,13}|\+[1-9]\d{7,14})$');

-- Identificador do WhatsApp (só dígitos, com DDI). Sem "+", é do Brasil e ganha o 55.
create or replace function public.whatsapp_international_id(p_phone text)
returns text
language sql
immutable
set search_path to ''
as $$
  select case
    when btrim(coalesce(p_phone, '')) like '+%' then regexp_replace(p_phone, '\D', '', 'g')
    when regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') like '55%' and char_length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) >= 12
      then regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')
    else '55' || regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')
  end;
$$;

CREATE OR REPLACE FUNCTION public.create_order(p_account_id uuid, p_name text, p_email text, p_whatsapp text, p_document text, p_birth_date date, p_instagram text, p_city text, p_state text, p_payment_method payment_method, p_hold_minutes integer, p_cart_code text)
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
$function$
;

CREATE OR REPLACE FUNCTION public.whatsapp_phone_key(p_phone text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  with full_id as (select public.whatsapp_international_id(p_phone) as id)
  select case when char_length(id) = 13 and left(id, 2) = '55' and substr(id, 5, 1) = '9' then left(id, 4) || substr(id, 6) else id end from full_id;
$function$
;

CREATE OR REPLACE FUNCTION public.queue_whatsapp_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  message_id uuid;
  target_url text;
  send_secret text;
begin
  if old.status <> 'awaiting_payment' or new.status <> 'paid' then
    return null;
  end if;
  if new.cart_code is not null and new.cart_code <> new.code then
    return null;
  end if;
  if new.customer_whatsapp is null then
    return null;
  end if;
  if not coalesce((select s.auto_delivery from public.whatsapp_settings s), false) then
    return null;
  end if;

  insert into public.whatsapp_messages (order_id, kind, to_phone)
  values (
    new.id,
    'payment_confirmed',
    public.whatsapp_international_id(new.customer_whatsapp)
  )
  returning id into message_id;

  select decrypted_secret into target_url from vault.decrypted_secrets where name = 'whatsapp_send_url';
  select decrypted_secret into send_secret from vault.decrypted_secrets where name = 'whatsapp_send_secret';
  if target_url is null or send_secret is null then
    raise warning 'whatsapp: whatsapp_send_url ou whatsapp_send_secret ausente no Vault; mensagem % ficou na fila', message_id;
    return null;
  end if;

  -- pg_net chama depois do commit: o pagamento é gravado mesmo se a função falhar.
  perform net.http_post(
    url := target_url,
    body := jsonb_build_object('message_id', message_id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-whatsapp-secret', send_secret),
    timeout_milliseconds := 10000
  );
  return null;
end;
$function$

;

CREATE OR REPLACE FUNCTION public.whatsapp_queue_followups()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      public.whatsapp_international_id(o.customer_whatsapp)
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
$function$

-----

;

insert into supabase_migrations.schema_migrations (version, name) values ('20261230120000', 'international_whatsapp') on conflict do nothing;
