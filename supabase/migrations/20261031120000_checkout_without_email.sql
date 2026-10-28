-- Checkout enxuto: a ficha fica em nome, WhatsApp, CPF/CNPJ e como conheceu a loja.
-- O acesso da conta vai pelo WhatsApp, que passa a identificar quem comprou; a maioridade é declarada no aceite.
-- Pedidos antigos continuam com e-mail, nascimento e cidade; Meus dados aceita o e-mail ou o WhatsApp da compra.

alter table public.orders alter column customer_email drop not null;

-- ---------------------------------------------------------------------------
-- 1. Checkout
-- ---------------------------------------------------------------------------

-- Mesma etapa interna do security_hardening: e-mail, nascimento, cidade e estado viram opcionais e só são conferidos quando vierem.
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
  -- O checkout atual não pede nascimento (a maioridade é declarada no aceite); quando vier, vale a regra dos 18 anos.
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

  -- Freio contra quem tenta segurar o estoque inteiro com pedidos falsos: WhatsApp e CPF valem mesmo sem e-mail.
  document_hash := public.hash_pii(clean_document);
  select count(*) into open_orders from public.orders
    where status = 'awaiting_payment' and expires_at > now()
      and (customer_email = clean_email or customer_whatsapp = clean_whatsapp or customer_document_hash = document_hash);
  if open_orders >= 2 then
    raise exception 'too_many_open_orders' using errcode = 'P0001';
  end if;

  select * into acc from public.accounts where id = p_account_id for update;
  if not found then
    raise exception 'account_not_found' using errcode = 'P0001';
  end if;

  if acc.status = 'sold'
     or (acc.status = 'reserved' and (acc.reserved_until is null or acc.reserved_until > now())) then
    raise exception 'account_unavailable' using errcode = 'P0001';
  end if;

  -- Reserva anterior venceu sem pagamento: o pedido antigo é cancelado antes de liberar a conta.
  update public.orders set status = 'canceled'
    where account_id = acc.id and status = 'awaiting_payment';

  loop
    attempt := attempt + 1;
    begin
      insert into public.orders (
        code, account_id, account_handle, account_name, account_platform,
        customer_name, customer_email, customer_whatsapp,
        customer_document, customer_birth_date, customer_instagram, customer_city, customer_state,
        payment_method, total_cents, expires_at
      ) values (
        public.generate_order_code(), acc.id, acc.handle, acc.display_name, acc.platform,
        clean_name, clean_email, clean_whatsapp,
        clean_document, p_birth_date, clean_instagram, clean_city, clean_state,
        p_payment_method, acc.price_cents, now() + make_interval(mins => p_hold_minutes)
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

-- ---------------------------------------------------------------------------
-- 2. Meus dados: e-mail ou WhatsApp + código do pedido
-- ---------------------------------------------------------------------------

alter table public.data_requests alter column email drop not null;
alter table public.data_requests add column whatsapp text check (whatsapp is null or whatsapp ~ '^\d{10,13}$');
alter table public.data_requests add constraint data_requests_has_contact check (email is not null or whatsapp is not null);
create index data_requests_whatsapp_idx on public.data_requests (whatsapp);

/** Separa o contato digitado em e-mail (tem @) ou WhatsApp (só os dígitos). */
create or replace function public.parse_contact(p_contact text, out email text, out whatsapp text)
language sql
immutable
set search_path = ''
as $$
  select
    case when position('@' in c) > 0 then c end,
    case when position('@' in c) = 0 then nullif(regexp_replace(c, '\D', '', 'g'), '') end
  from (select lower(btrim(coalesce(p_contact, ''))) as c) as input;
$$;

revoke all on function public.parse_contact(text) from public, anon, authenticated;

drop function public.privacy_lookup(text, text);
drop function public.privacy_request(text, text, public.data_request_kind, text);
drop function public.owns_order(text, text);

create or replace function public.owns_order(p_email text, p_whatsapp text, p_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.orders
    where code = p_code and (customer_email = p_email or customer_whatsapp = p_whatsapp)
  );
$$;

revoke all on function public.owns_order(text, text, text) from public, anon, authenticated;

create or replace function public.privacy_lookup(p_contact text, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  contact_email text;
  contact_whatsapp text;
  clean_code text := upper(btrim(coalesce(p_code, '')));
begin
  select email, whatsapp into contact_email, contact_whatsapp from public.parse_contact(p_contact);
  if not public.privacy_attempt_allowed(coalesce(contact_email, contact_whatsapp, '')) then
    raise exception 'too_many_attempts' using errcode = 'P0001';
  end if;
  if not public.owns_order(contact_email, contact_whatsapp, clean_code) then
    return null;
  end if;

  return jsonb_build_object(
    'contact', coalesce(contact_email, contact_whatsapp),
    'generated_at', now(),
    'orders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', o.code, 'account_id', o.account_id, 'account_handle', o.account_handle, 'account_name', o.account_name,
        'account_platform', o.account_platform, 'customer_name', o.customer_name, 'customer_email', o.customer_email,
        'customer_whatsapp', o.customer_whatsapp, 'customer_document', public.decrypt_pii(o.customer_document_encrypted),
        'customer_birth_date', o.customer_birth_date, 'customer_instagram', o.customer_instagram,
        'customer_city', o.customer_city, 'customer_state', o.customer_state, 'payment_method', o.payment_method,
        'total_cents', o.total_cents, 'status', o.status, 'expires_at', o.expires_at, 'created_at', o.created_at,
        'delivered_at', o.delivered_at
      ) order by o.created_at desc)
      from public.orders o where o.customer_email = contact_email or o.customer_whatsapp = contact_whatsapp
    ), '[]'::jsonb),
    'customers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', c.name, 'document', public.decrypt_pii(c.document_encrypted), 'birth_date', c.birth_date, 'email', c.email,
        'whatsapp', c.whatsapp, 'instagram', c.instagram, 'city', c.city, 'state', c.state, 'source', c.source,
        'interest', c.interest, 'notes', c.notes, 'created_at', c.created_at
      ))
      from public.customers c
      where lower(c.email) = contact_email or regexp_replace(coalesce(c.whatsapp, ''), '\D', '', 'g') = contact_whatsapp
    ), '[]'::jsonb),
    'consents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'order_code', o.code, 'document_slug', r.document_slug, 'document_version', r.document_version,
        'document_sha256', r.document_sha256, 'accepted_at', r.accepted_at, 'ip_address', r.ip_address,
        'user_agent', r.user_agent
      ) order by r.accepted_at desc)
      from public.consent_records r join public.orders o on o.id = r.order_id
      where o.customer_email = contact_email or o.customer_whatsapp = contact_whatsapp
    ), '[]'::jsonb),
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'protocol', d.protocol, 'kind', d.kind, 'status', d.status, 'details', d.details, 'response', d.response,
        'created_at', d.created_at, 'due_at', d.due_at, 'resolved_at', d.resolved_at
      ) order by d.created_at desc)
      from public.data_requests d where d.email = contact_email or d.whatsapp = contact_whatsapp
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.privacy_lookup(text, text) from public;
grant execute on function public.privacy_lookup(text, text) to anon, authenticated;

create or replace function public.privacy_request(p_contact text, p_code text, p_kind public.data_request_kind, p_details text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  contact_email text;
  contact_whatsapp text;
  clean_code text := upper(btrim(coalesce(p_code, '')));
  clean_details text := nullif(btrim(coalesce(p_details, '')), '');
  created public.data_requests;
  open_requests integer;
begin
  select email, whatsapp into contact_email, contact_whatsapp from public.parse_contact(p_contact);
  if char_length(coalesce(clean_details, '')) > 2000 then
    raise exception 'invalid_details' using errcode = 'P0001';
  end if;
  if not public.privacy_attempt_allowed(coalesce(contact_email, contact_whatsapp, '')) then
    raise exception 'too_many_attempts' using errcode = 'P0001';
  end if;
  if not public.owns_order(contact_email, contact_whatsapp, clean_code) then
    return null;
  end if;

  select count(*) into open_requests from public.data_requests
    where (email = contact_email or whatsapp = contact_whatsapp) and status = 'open';
  if open_requests >= 5 then
    raise exception 'too_many_open_requests' using errcode = 'P0001';
  end if;

  insert into public.data_requests (protocol, kind, email, whatsapp, order_code, details)
  values (public.generate_privacy_protocol(), p_kind, contact_email, contact_whatsapp, clean_code, clean_details)
  returning * into created;

  insert into public.notifications (kind, title, body, link)
  values ('privacy', 'Solicitação LGPD ' || created.protocol,
          'Um titular abriu uma solicitação em Meus dados. Responda até ' || to_char(created.due_at at time zone 'America/Sao_Paulo', 'DD/MM') || '.',
          '/admin/privacidade');

  return jsonb_build_object('protocol', created.protocol, 'due_at', created.due_at);
end;
$$;

revoke all on function public.privacy_request(text, text, public.data_request_kind, text) from public;
grant execute on function public.privacy_request(text, text, public.data_request_kind, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Anonimização e retenção
-- ---------------------------------------------------------------------------

drop function public.anonymize_data_subject(text);

/** Mesma regra do security_hardening, achando o titular pelo e-mail ou pelo WhatsApp. */
create or replace function public.anonymize_data_subject(p_contact text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  contact_email text;
  contact_whatsapp text;
  owned uuid[];
  removable uuid[];
  anonymized integer;
  kept integer;
  deleted_customers integer;
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  select email, whatsapp into contact_email, contact_whatsapp from public.parse_contact(p_contact);
  if not (
    coalesce(contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$', false)
    or coalesce(contact_whatsapp ~ '^\d{10,13}$', false)
  ) then
    raise exception 'invalid_contact' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(id), '{}') into owned from public.orders
    where customer_email = contact_email or customer_whatsapp = contact_whatsapp;

  select coalesce(array_agg(id), '{}') into removable from public.orders
    where id = any(owned) and (status = 'canceled' or (status = 'awaiting_payment' and expires_at <= now()));
  anonymized := public.anonymize_orders(removable);

  update public.orders set customer_instagram = null
    where id = any(owned) and status in ('paid', 'delivered', 'awaiting_payment');
  select count(*) into kept from public.orders where id = any(owned) and not (id = any(removable));

  delete from public.customers
    where lower(email) = contact_email or regexp_replace(coalesce(whatsapp, ''), '\D', '', 'g') = contact_whatsapp;
  get diagnostics deleted_customers = row_count;

  result := jsonb_build_object('anonymized_orders', anonymized, 'kept_orders', kept, 'deleted_customers', deleted_customers);
  perform public.record_audit('anonymize', 'data_subject', public.hash_pii(coalesce(contact_email, contact_whatsapp)), result);
  return result;
end;
$$;

revoke all on function public.anonymize_data_subject(text) from public, anon;
grant execute on function public.anonymize_data_subject(text) to authenticated;

-- Pedido sem e-mail também entra na retenção (o filtro antigo ignorava e-mail vazio).
create or replace function public.run_retention_policy()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  expired uuid[];
  anonymized integer;
  deleted_leads integer;
  deleted_notifications integer;
  deleted_requests integer;
  deleted_attempts integer;
  deleted_audit integer;
begin
  select coalesce(array_agg(id), '{}') into expired from public.orders
    where coalesce(customer_email, '') not like '%@anonimizado.invalid'
      and (
        ((status = 'canceled' or (status = 'awaiting_payment' and expires_at <= now())) and created_at < now() - interval '6 months')
        or (status in ('paid', 'delivered') and created_at < now() - interval '5 years')
      );
  anonymized := public.anonymize_orders(expired);

  delete from public.leads where stage <> 'won' and updated_at < now() - interval '12 months';
  get diagnostics deleted_leads = row_count;

  delete from public.notifications where kind in ('order', 'privacy', 'security') and created_at < now() - interval '90 days';
  get diagnostics deleted_notifications = row_count;

  delete from public.data_requests where status <> 'open' and created_at < now() - interval '5 years';
  get diagnostics deleted_requests = row_count;

  delete from public.rate_limit_hits where created_at < now() - interval '30 days';
  get diagnostics deleted_attempts = row_count;

  delete from public.audit_events where created_at < now() - interval '1 year';
  get diagnostics deleted_audit = row_count;

  return jsonb_build_object(
    'anonymized_orders', anonymized,
    'deleted_leads', deleted_leads,
    'deleted_notifications', deleted_notifications,
    'deleted_requests', deleted_requests,
    'deleted_attempts', deleted_attempts,
    'deleted_audit_events', deleted_audit
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Termos e Política 1.1.0: checkout enxuto, entrega pelo WhatsApp e maioridade declarada (node scripts/legal-hashes.mjs)
-- ---------------------------------------------------------------------------

insert into public.legal_documents (slug, version, sha256) values
  ('terms', '1.1.0', '76e78fc11ebe39f511c367871943101ec8bc3c59ffdf61a1c39314eb69d9715b'),
  ('privacy', '1.1.0', '6f6ec3b9562f5de2408127adae8ec1e894f0b65a19a8bb0117d1a094a92139fc');
