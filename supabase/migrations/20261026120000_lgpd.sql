-- LGPD: prova do aceite, direitos do titular e prazos de retenção.
-- 1. legal_documents guarda versão e hash de cada Termos de Uso e Política de Privacidade publicados.
--    Documento novo = versão nova aqui (o hash sai de `node scripts/legal-hashes.mjs`).
-- 2. place_order passa a exigir o aceite da versão atual dos dois documentos e grava a prova em consent_records.
-- 3. A página pública do pedido mostra só o primeiro nome.
-- 4. Meus dados: o titular prova que é dono do pedido (e-mail + código), vê e baixa os dados e abre solicitações.
-- 5. Painel: responder solicitações, anonimizar um titular e aplicar os prazos de retenção.

-- ---------------------------------------------------------------------------
-- Cabeçalhos da requisição (IP e navegador para a prova do aceite e o limite de tentativas)
-- ---------------------------------------------------------------------------

create or replace function public.request_header(p_name text)
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(current_setting('request.headers', true), '')::json ->> lower(p_name);
$$;

create or replace function public.request_ip()
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(btrim(split_part(coalesce(public.request_header('x-forwarded-for'), public.request_header('x-real-ip'), ''), ',', 1)), '');
$$;

revoke all on function public.request_header(text) from public, anon, authenticated;
revoke all on function public.request_ip() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Documentos legais publicados
-- ---------------------------------------------------------------------------

create table public.legal_documents (
  slug text not null check (slug in ('terms', 'privacy')),
  version text not null check (version ~ '^\d+\.\d+\.\d+$'),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  published_at timestamptz not null default now(),
  primary key (slug, version)
);

alter table public.legal_documents enable row level security;

create policy "anyone reads legal documents" on public.legal_documents
  for select to anon, authenticated using (true);

-- Só migration publica documento.
revoke insert, update, delete, truncate on public.legal_documents from anon, authenticated;

insert into public.legal_documents (slug, version, sha256) values
  ('terms', '1.0.0', 'c5f33ccbd9e41671796f72aaa4f38147355ed874417e3cb2a2a4228abbb26451'),
  ('privacy', '1.0.0', 'a974c81fa1549a4b09b538519907c440b1c26093dd93f72d65a5ff3832e50c69');

/** Versão mais recente de cada documento: é a única que o checkout aceita. */
create or replace function public.is_current_legal_document(p_slug text, p_version text, p_sha256 text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((
    select d.version = p_version and d.sha256 = p_sha256
    from public.legal_documents d
    where d.slug = p_slug
    order by d.published_at desc, d.version desc
    limit 1
  ), false);
$$;

revoke all on function public.is_current_legal_document(text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Prova do aceite
-- ---------------------------------------------------------------------------

create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  document_slug text not null,
  document_version text not null,
  document_sha256 text not null check (document_sha256 ~ '^[0-9a-f]{64}$'),
  accepted_at timestamptz not null default now(),
  ip_address text check (ip_address is null or char_length(ip_address) <= 64),
  user_agent text check (user_agent is null or char_length(user_agent) <= 400),
  foreign key (document_slug, document_version) references public.legal_documents (slug, version),
  unique (order_id, document_slug)
);

alter table public.consent_records enable row level security;

create policy "admins read consent records" on public.consent_records
  for select to authenticated using (public.is_admin());

-- Ninguém grava nem apaga pelo painel: a prova só entra pelo place_order.
revoke all on public.consent_records from anon;
revoke insert, update, delete, truncate on public.consent_records from authenticated;

-- ---------------------------------------------------------------------------
-- Checkout com aceite
-- ---------------------------------------------------------------------------

-- A função anterior vira etapa interna: só o place_order novo, que confere o aceite, chama.
alter function public.place_order(uuid, text, text, text, text, date, text, text, text, public.payment_method, integer)
  rename to create_order;
revoke all on function public.create_order(uuid, text, text, text, text, date, text, text, text, public.payment_method, integer)
  from public, anon, authenticated;

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
  p_hold_minutes integer default 120
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  placed jsonb;
  placed_id uuid;
  client_ip text := left(public.request_ip(), 64);
  client_agent text := left(public.request_header('user-agent'), 400);
begin
  if not public.is_current_legal_document('terms', p_terms_version, p_terms_sha256)
     or not public.is_current_legal_document('privacy', p_privacy_version, p_privacy_sha256) then
    raise exception 'outdated_legal_documents' using errcode = 'P0001';
  end if;

  placed := public.create_order(
    p_account_id, p_name, p_email, p_whatsapp, p_document, p_birth_date,
    p_instagram, p_city, p_state, p_payment_method, p_hold_minutes
  );
  select id into placed_id from public.orders where code = placed ->> 'code';

  insert into public.consent_records (order_id, document_slug, document_version, document_sha256, ip_address, user_agent)
  values
    (placed_id, 'terms', p_terms_version, p_terms_sha256, client_ip, client_agent),
    (placed_id, 'privacy', p_privacy_version, p_privacy_sha256, client_ip, client_agent);

  return placed;
end;
$$;

revoke all on function public.place_order(uuid, text, text, text, text, date, text, text, text, public.payment_method, text, text, text, text, integer) from public;
grant execute on function public.place_order(uuid, text, text, text, text, date, text, text, text, public.payment_method, text, text, text, text, integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Página pública do pedido: só o primeiro nome
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
    'created_at', o.created_at
  );
$$;

revoke all on function public.public_order_json(public.orders) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Solicitações do titular (art. 18)
-- ---------------------------------------------------------------------------

create type public.data_request_kind as enum (
  'confirmation', 'access', 'correction', 'anonymization', 'portability', 'consent_deletion',
  'sharing_info', 'consent_info', 'consent_revocation', 'automated_review', 'objection'
);
create type public.data_request_status as enum ('open', 'done', 'rejected');

create table public.data_requests (
  id uuid primary key default gen_random_uuid(),
  protocol text not null unique check (protocol ~ '^LGPD-[A-Z0-9]{8}$'),
  kind public.data_request_kind not null,
  email text not null check (char_length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  order_code text check (order_code is null or order_code ~ '^JD-[A-Z0-9]{6}$'),
  details text check (details is null or char_length(details) <= 2000),
  status public.data_request_status not null default 'open',
  response text check (response is null or char_length(response) <= 2000),
  created_at timestamptz not null default now(),
  -- Prazo de resposta prometido na Política de Privacidade.
  due_at timestamptz not null default now() + interval '15 days',
  resolved_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint rejected_needs_reason check (status <> 'rejected' or char_length(btrim(coalesce(response, ''))) > 0)
);

create index data_requests_status_due_idx on public.data_requests (status, due_at);
create index data_requests_email_idx on public.data_requests (email);

create trigger data_requests_touch before update on public.data_requests
  for each row execute function public.touch_updated_at();

create or replace function public.stamp_data_request_resolution()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.resolved_at := case when new.status = 'open' then null else coalesce(old.resolved_at, now()) end;
  return new;
end;
$$;

create trigger data_requests_stamp_resolution before update on public.data_requests
  for each row execute function public.stamp_data_request_resolution();

alter table public.data_requests enable row level security;

create policy "admins read data requests" on public.data_requests
  for select to authenticated using (public.is_admin());

create policy "admins answer data requests" on public.data_requests
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- O painel só muda situação e resposta; a solicitação em si entra pelo privacy_request.
revoke all on public.data_requests from anon;
revoke insert, update, delete, truncate on public.data_requests from authenticated;
grant update (status, response) on public.data_requests to authenticated;

-- Tentativas em Meus dados, para barrar quem tenta adivinhar códigos de pedido.
create table public.privacy_attempts (
  id bigint generated always as identity primary key,
  key text not null check (char_length(key) <= 300),
  created_at timestamptz not null default now()
);

create index privacy_attempts_key_idx on public.privacy_attempts (key, created_at desc);

alter table public.privacy_attempts enable row level security;
revoke all on public.privacy_attempts from anon, authenticated;

-- Pedido de solicitação vira aviso no sininho.
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in ('order', 'news', 'privacy'));

-- ---------------------------------------------------------------------------
-- Meus dados (site público)
-- ---------------------------------------------------------------------------

/** Registra a tentativa e diz se o limite de 10 por hora estourou. A tentativa só conta se não estourou. */
create or replace function public.privacy_attempt_allowed(p_email text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  limiter_key text := coalesce('ip:' || public.request_ip(), 'email:' || p_email);
begin
  if (select count(*) from public.privacy_attempts
      where key = limiter_key and created_at > now() - interval '1 hour') >= 10 then
    return false;
  end if;
  insert into public.privacy_attempts (key) values (limiter_key);
  return true;
end;
$$;

revoke all on function public.privacy_attempt_allowed(text) from public, anon, authenticated;

create or replace function public.owns_order(p_email text, p_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.orders where code = p_code and customer_email = p_email);
$$;

revoke all on function public.owns_order(text, text) from public, anon, authenticated;

/**
 * Tudo o que a loja guarda ligado ao e-mail de quem prova ser dono de um pedido.
 * Devolve nulo se e-mail e código não baterem (a tentativa conta no limite).
 */
create or replace function public.privacy_lookup(p_email text, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_email text := lower(btrim(coalesce(p_email, '')));
  clean_code text := upper(btrim(coalesce(p_code, '')));
begin
  if not public.privacy_attempt_allowed(clean_email) then
    raise exception 'too_many_attempts' using errcode = 'P0001';
  end if;
  if not public.owns_order(clean_email, clean_code) then
    return null;
  end if;

  return jsonb_build_object(
    'email', clean_email,
    'generated_at', now(),
    'orders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', o.code, 'account_id', o.account_id, 'account_handle', o.account_handle, 'account_name', o.account_name,
        'account_platform', o.account_platform, 'customer_name', o.customer_name, 'customer_email', o.customer_email,
        'customer_whatsapp', o.customer_whatsapp, 'customer_document', o.customer_document,
        'customer_birth_date', o.customer_birth_date, 'customer_instagram', o.customer_instagram,
        'customer_city', o.customer_city, 'customer_state', o.customer_state, 'payment_method', o.payment_method,
        'total_cents', o.total_cents, 'status', o.status, 'expires_at', o.expires_at, 'created_at', o.created_at,
        'delivered_at', o.delivered_at
      ) order by o.created_at desc)
      from public.orders o where o.customer_email = clean_email
    ), '[]'::jsonb),
    'customers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', c.name, 'document', c.document, 'birth_date', c.birth_date, 'email', c.email, 'whatsapp', c.whatsapp,
        'instagram', c.instagram, 'city', c.city, 'state', c.state, 'source', c.source, 'interest', c.interest,
        'notes', c.notes, 'created_at', c.created_at
      ))
      from public.customers c where lower(c.email) = clean_email
    ), '[]'::jsonb),
    'consents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'order_code', o.code, 'document_slug', r.document_slug, 'document_version', r.document_version,
        'document_sha256', r.document_sha256, 'accepted_at', r.accepted_at, 'ip_address', r.ip_address,
        'user_agent', r.user_agent
      ) order by r.accepted_at desc)
      from public.consent_records r join public.orders o on o.id = r.order_id
      where o.customer_email = clean_email
    ), '[]'::jsonb),
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'protocol', d.protocol, 'kind', d.kind, 'status', d.status, 'details', d.details, 'response', d.response,
        'created_at', d.created_at, 'due_at', d.due_at, 'resolved_at', d.resolved_at
      ) order by d.created_at desc)
      from public.data_requests d where d.email = clean_email
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.privacy_lookup(text, text) from public;
grant execute on function public.privacy_lookup(text, text) to anon, authenticated;

create or replace function public.generate_privacy_protocol()
returns text
language sql
volatile
set search_path = ''
as $$
  select 'LGPD-' || string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::integer, 1), '')
  from generate_series(1, 8);
$$;

revoke all on function public.generate_privacy_protocol() from public, anon, authenticated;

/** Abre uma solicitação do titular. Devolve protocolo e prazo, ou nulo se e-mail e código não baterem. */
create or replace function public.privacy_request(p_email text, p_code text, p_kind public.data_request_kind, p_details text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_email text := lower(btrim(coalesce(p_email, '')));
  clean_code text := upper(btrim(coalesce(p_code, '')));
  clean_details text := nullif(btrim(coalesce(p_details, '')), '');
  created public.data_requests;
  open_requests integer;
begin
  if char_length(coalesce(clean_details, '')) > 2000 then
    raise exception 'invalid_details' using errcode = 'P0001';
  end if;
  if not public.privacy_attempt_allowed(clean_email) then
    raise exception 'too_many_attempts' using errcode = 'P0001';
  end if;
  if not public.owns_order(clean_email, clean_code) then
    return null;
  end if;

  select count(*) into open_requests from public.data_requests where email = clean_email and status = 'open';
  if open_requests >= 5 then
    raise exception 'too_many_open_requests' using errcode = 'P0001';
  end if;

  insert into public.data_requests (protocol, kind, email, order_code, details)
  values (public.generate_privacy_protocol(), p_kind, clean_email, clean_code, clean_details)
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
-- Anonimização e retenção (painel)
-- ---------------------------------------------------------------------------

/** Tira de um pedido tudo o que identifica a pessoa. O pedido segue nas contas do financeiro. */
create or replace function public.anonymize_orders(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  delete from public.notifications n
    using public.orders o
    where o.id = any(p_ids) and n.kind = 'order' and n.title = 'Novo pedido ' || o.code;

  update public.consent_records set ip_address = null, user_agent = null where order_id = any(p_ids);

  update public.orders set
    customer_name = 'Titular anonimizado',
    customer_email = 'anonimo.' || lower(code) || '@anonimizado.invalid',
    customer_whatsapp = null,
    customer_document = null,
    customer_birth_date = null,
    customer_instagram = null,
    customer_city = null,
    customer_state = null
  where id = any(p_ids);
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.anonymize_orders(uuid[]) from public, anon, authenticated;

/**
 * Atende eliminação ou anonimização de um titular.
 * Pedido cancelado ou que venceu sem pagamento é anonimizado na hora. Pedido pago ou entregue fica
 * (nota fiscal e defesa por 5 anos), só sem o Instagram. Cadastro manual com o mesmo e-mail é apagado.
 */
create or replace function public.anonymize_data_subject(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_email text := lower(btrim(coalesce(p_email, '')));
  removable uuid[];
  anonymized integer;
  kept integer;
  deleted_customers integer;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if clean_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_email' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(id), '{}') into removable from public.orders
    where customer_email = clean_email
      and (status = 'canceled' or (status = 'awaiting_payment' and expires_at <= now()));
  anonymized := public.anonymize_orders(removable);

  update public.orders set customer_instagram = null
    where customer_email = clean_email and status in ('paid', 'delivered', 'awaiting_payment');
  select count(*) into kept from public.orders where customer_email = clean_email;

  delete from public.customers where lower(email) = clean_email;
  get diagnostics deleted_customers = row_count;

  return jsonb_build_object('anonymized_orders', anonymized, 'kept_orders', kept, 'deleted_customers', deleted_customers);
end;
$$;

revoke all on function public.anonymize_data_subject(text) from public, anon;
grant execute on function public.anonymize_data_subject(text) to authenticated;

/** Prazos da Política de Privacidade (seção 8). Sem grant: roda pelo painel (abaixo) ou pelo pg_cron. */
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
begin
  select coalesce(array_agg(id), '{}') into expired from public.orders
    where customer_email not like '%@anonimizado.invalid'
      and (
        ((status = 'canceled' or (status = 'awaiting_payment' and expires_at <= now())) and created_at < now() - interval '6 months')
        or (status in ('paid', 'delivered') and created_at < now() - interval '5 years')
      );
  anonymized := public.anonymize_orders(expired);

  delete from public.leads where stage <> 'won' and updated_at < now() - interval '12 months';
  get diagnostics deleted_leads = row_count;

  delete from public.notifications where kind in ('order', 'privacy') and created_at < now() - interval '90 days';
  get diagnostics deleted_notifications = row_count;

  delete from public.data_requests where status <> 'open' and created_at < now() - interval '5 years';
  get diagnostics deleted_requests = row_count;

  delete from public.privacy_attempts where created_at < now() - interval '30 days';
  get diagnostics deleted_attempts = row_count;

  return jsonb_build_object(
    'anonymized_orders', anonymized,
    'deleted_leads', deleted_leads,
    'deleted_notifications', deleted_notifications,
    'deleted_requests', deleted_requests,
    'deleted_attempts', deleted_attempts
  );
end;
$$;

revoke all on function public.run_retention_policy() from public, anon, authenticated;

create or replace function public.apply_retention_policy()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  return public.run_retention_policy();
end;
$$;

revoke all on function public.apply_retention_policy() from public, anon;
grant execute on function public.apply_retention_policy() to authenticated;
