-- Endurecimento de segurança (varredura de 22/10). Depende da migration de LGPD (20261026120000).
-- 1. IP do visitante vem do cabeçalho que a Cloudflare grava (cf-connecting-ip), não do X-Forwarded-For que o cliente forja.
-- 2. Limite de tentativas genérico: checkout, página do pedido e Meus dados. Estourar avisa no sininho.
-- 3. Checkout: prazo de reserva fixo no servidor, teto de pedidos abertos por e-mail, WhatsApp, CPF e IP.
-- 4. CPF/CNPJ criptografado (pgcrypto + chave no Vault). Só administrador lê o número aberto.
-- 5. is_admin exige a verificação em duas etapas de quem a ligou e sessão aberta há menos de 7 dias.
-- 6. Políticas com (select ...) para o banco avaliar uma vez por consulta, não uma vez por linha.
-- 7. Visitante não lê o parceiro de cada conta.
-- 8. Tabela nova no schema public nasce com RLS ligado, e sem acesso automático para a chave anon.
-- 9. Registro de auditoria e avisos de segurança no sininho (login, usuário criado ou removido, limite estourado).

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- 1. IP do visitante
-- ---------------------------------------------------------------------------

create or replace function public.request_ip()
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(btrim(coalesce(
    public.request_header('cf-connecting-ip'),
    public.request_header('x-real-ip'),
    split_part(coalesce(public.request_header('x-forwarded-for'), ''), ',', 1)
  )), '');
$$;

revoke all on function public.request_ip() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Limite de tentativas
-- ---------------------------------------------------------------------------

alter table public.privacy_attempts rename to rate_limit_hits;
alter index public.privacy_attempts_key_idx rename to rate_limit_hits_key_idx;

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('order', 'news', 'privacy', 'security'));

/** Aviso de segurança no sininho, no máximo um igual por janela (ataque contínuo não lota a lista). */
create or replace function public.notify_security(p_title text, p_body text, p_link text, p_window interval)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.notifications
    where kind = 'security' and title = p_title and body = p_body and created_at > now() - p_window
  ) then
    return;
  end if;
  insert into public.notifications (kind, title, body, link) values ('security', p_title, p_body, p_link);
end;
$$;

revoke all on function public.notify_security(text, text, text, interval) from public, anon, authenticated;

/**
 * Conta a tentativa e diz se ainda cabe no limite. Tentativa recusada não conta (a exceção desfaz a transação),
 * então a janela volta a abrir sozinha. A tentativa que atinge o limite avisa no sininho.
 */
create or replace function public.rate_limit_allows(p_key text, p_label text, p_max integer, p_window interval)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  limiter_key text := left(p_key, 300);
  hits integer;
begin
  select count(*) into hits from public.rate_limit_hits
    where key = limiter_key and created_at > now() - p_window;
  if hits >= p_max then
    return false;
  end if;
  insert into public.rate_limit_hits (key) values (limiter_key);
  if hits + 1 = p_max then
    perform public.notify_security(
      'Limite de tentativas atingido',
      'Um mesmo visitante chegou ao limite em ' || p_label || '. Se não reconhecer, pode ser alguém testando o site.',
      '/admin',
      p_window
    );
  end if;
  return true;
end;
$$;

revoke all on function public.rate_limit_allows(text, text, integer, interval) from public, anon, authenticated;

/** Chave do limite: o IP quando existe, senão o identificador que a função recebeu. */
create or replace function public.rate_limit_key(p_scope text, p_fallback text)
returns text
language sql
stable
set search_path = ''
as $$
  select p_scope || ':' || coalesce('ip:' || public.request_ip(), 'id:' || coalesce(p_fallback, ''));
$$;

revoke all on function public.rate_limit_key(text, text) from public, anon, authenticated;

create or replace function public.privacy_attempt_allowed(p_email text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select public.rate_limit_allows(public.rate_limit_key('privacy', p_email), 'Meus dados', 10, interval '1 hour');
$$;

revoke all on function public.privacy_attempt_allowed(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. CPF/CNPJ criptografado
-- ---------------------------------------------------------------------------

-- A chave fica no Vault do Supabase (cifrada fora do banco): um dump ou backup vazado traz só texto cifrado.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'pii_encryption_key') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'pii_encryption_key',
      'Chave do CPF/CNPJ de pedidos e clientes. Perder esta chave = perder os documentos.'
    );
  end if;
end;
$$;

create or replace function public.pii_key()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  secret text;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'pii_encryption_key';
  if secret is null then
    raise exception 'pii_key_missing' using errcode = 'P0001';
  end if;
  return secret;
end;
$$;

create or replace function public.encrypt_pii(p_value text)
returns bytea
language sql
volatile
security definer
set search_path = ''
as $$
  select extensions.pgp_sym_encrypt(p_value, public.pii_key());
$$;

create or replace function public.decrypt_pii(p_value bytea)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when p_value is null then null else extensions.pgp_sym_decrypt(p_value, public.pii_key()) end;
$$;

/** Impressão digital do documento: compara sem abrir (limite de pedidos por CPF). */
create or replace function public.hash_pii(p_value text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select encode(extensions.hmac(p_value, public.pii_key(), 'sha256'), 'hex');
$$;

revoke all on function public.pii_key() from public, anon, authenticated;
revoke all on function public.encrypt_pii(text) from public, anon, authenticated;
revoke all on function public.decrypt_pii(bytea) from public, anon, authenticated;
revoke all on function public.hash_pii(text) from public, anon, authenticated;

alter table public.orders
  add column customer_document_encrypted bytea,
  add column customer_document_hash text;

create index orders_document_hash_idx on public.orders (customer_document_hash) where customer_document_hash is not null;

alter table public.customers add column document_encrypted bytea;

-- A coluna de texto continua existindo só como entrada: o gatilho cifra e apaga o número aberto antes de gravar.
-- O gatilho de update só dispara quando o update cita a coluna, então "set document = null" apaga o documento
-- e um update de outra coluna não mexe nele.
create or replace function public.encrypt_order_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.customer_document is null then
    new.customer_document_encrypted := null;
    new.customer_document_hash := null;
    return new;
  end if;
  if not public.is_valid_document(new.customer_document) then
    raise exception 'new row for relation "orders" violates check constraint "orders_customer_document_check"'
      using errcode = '23514';
  end if;
  new.customer_document_encrypted := public.encrypt_pii(new.customer_document);
  new.customer_document_hash := public.hash_pii(new.customer_document);
  new.customer_document := null;
  return new;
end;
$$;

create or replace function public.encrypt_customer_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.document is null then
    new.document_encrypted := null;
    return new;
  end if;
  if new.document !~ '^([0-9]{11}|[0-9]{14})$' then
    raise exception 'new row for relation "customers" violates check constraint "customers_document_check"'
      using errcode = '23514';
  end if;
  new.document_encrypted := public.encrypt_pii(new.document);
  new.document := null;
  return new;
end;
$$;

revoke all on function public.encrypt_order_document() from public, anon, authenticated;
revoke all on function public.encrypt_customer_document() from public, anon, authenticated;

create trigger orders_encrypt_document before insert or update of customer_document on public.orders
  for each row execute function public.encrypt_order_document();

create trigger customers_encrypt_document before insert or update of document on public.customers
  for each row execute function public.encrypt_customer_document();

-- Documentos já gravados passam a ser cifrados, sem mexer na data de atualização.
alter table public.orders disable trigger orders_touch;
update public.orders set customer_document = customer_document where customer_document is not null;
alter table public.orders enable trigger orders_touch;

alter table public.customers disable trigger customers_touch;
update public.customers set document = document where document is not null;
alter table public.customers enable trigger customers_touch;

-- Leitura pelo painel: colunas calculadas do PostgREST (select=customer_document:customer_document_plain).
create or replace function public.customer_document_plain(o public.orders)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when public.is_admin() then public.decrypt_pii(o.customer_document_encrypted) end;
$$;

create or replace function public.document_plain(c public.customers)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when public.is_admin() then public.decrypt_pii(c.document_encrypted) end;
$$;

revoke all on function public.customer_document_plain(public.orders) from public, anon;
revoke all on function public.document_plain(public.customers) from public, anon;
grant execute on function public.customer_document_plain(public.orders) to authenticated;
grant execute on function public.document_plain(public.customers) to authenticated;

-- Meus dados: o titular continua vendo o próprio documento (mesma função da LGPD, lendo a coluna cifrada).
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
        'customer_whatsapp', o.customer_whatsapp, 'customer_document', public.decrypt_pii(o.customer_document_encrypted),
        'customer_birth_date', o.customer_birth_date, 'customer_instagram', o.customer_instagram,
        'customer_city', o.customer_city, 'customer_state', o.customer_state, 'payment_method', o.payment_method,
        'total_cents', o.total_cents, 'status', o.status, 'expires_at', o.expires_at, 'created_at', o.created_at,
        'delivered_at', o.delivered_at
      ) order by o.created_at desc)
      from public.orders o where o.customer_email = clean_email
    ), '[]'::jsonb),
    'customers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', c.name, 'document', public.decrypt_pii(c.document_encrypted), 'birth_date', c.birth_date, 'email', c.email,
        'whatsapp', c.whatsapp, 'instagram', c.instagram, 'city', c.city, 'state', c.state, 'source', c.source,
        'interest', c.interest, 'notes', c.notes, 'created_at', c.created_at
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

-- ---------------------------------------------------------------------------
-- 3. Checkout
-- ---------------------------------------------------------------------------

-- Mesma etapa interna da LGPD, agora com o teto de pedidos abertos também por WhatsApp e CPF.
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
  clean_email text := lower(btrim(coalesce(p_email, '')));
  clean_whatsapp text := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
  clean_document text := regexp_replace(coalesce(p_document, ''), '\D', '', 'g');
  clean_instagram text := nullif(btrim(coalesce(p_instagram, '')), '');
  clean_city text := btrim(coalesce(p_city, ''));
  clean_state text := upper(btrim(coalesce(p_state, '')));
  document_hash text;
  open_orders integer;
  attempt integer := 0;
begin
  if char_length(clean_name) < 3 or char_length(clean_name) > 120 then
    raise exception 'invalid_name' using errcode = 'P0001';
  end if;
  if clean_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(clean_email) > 254 then
    raise exception 'invalid_email' using errcode = 'P0001';
  end if;
  if clean_whatsapp !~ '^\d{10,13}$' then
    raise exception 'invalid_whatsapp' using errcode = 'P0001';
  end if;
  if not public.is_valid_document(clean_document) then
    raise exception 'invalid_document' using errcode = 'P0001';
  end if;
  -- Compra só para maiores de 18 anos (termos de compra).
  if p_birth_date is null or p_birth_date < date '1900-01-01' or p_birth_date > (current_date - interval '18 years')::date then
    raise exception 'invalid_birth_date' using errcode = 'P0001';
  end if;
  if clean_instagram is not null and left(clean_instagram, 1) <> '@' then
    clean_instagram := '@' || clean_instagram;
  end if;
  if clean_instagram is not null and clean_instagram !~ '^@[A-Za-z0-9._]{1,30}$' then
    raise exception 'invalid_instagram' using errcode = 'P0001';
  end if;
  if char_length(clean_city) < 2 or char_length(clean_city) > 60 then
    raise exception 'invalid_city' using errcode = 'P0001';
  end if;
  if clean_state not in (
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
    'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ) then
    raise exception 'invalid_state' using errcode = 'P0001';
  end if;
  if p_hold_minutes not between 15 and 1440 then
    raise exception 'invalid_hold' using errcode = 'P0001';
  end if;

  -- Freio contra quem tenta segurar o estoque inteiro com pedidos falsos: trocar só o e-mail não basta.
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

revoke all on function public.create_order(uuid, text, text, text, text, date, text, text, text, public.payment_method, integer)
  from public, anon, authenticated;

-- Prazo de reserva que o checkout aceita. O parâmetro p_hold_minutes segue na assinatura só por compatibilidade.
create or replace function public.checkout_hold_minutes()
returns integer
language sql
immutable
set search_path = ''
as $$
  select 120;
$$;

revoke all on function public.checkout_hold_minutes() from public, anon, authenticated;

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
  open_from_ip integer;
begin
  if not public.is_current_legal_document('terms', p_terms_version, p_terms_sha256)
     or not public.is_current_legal_document('privacy', p_privacy_version, p_privacy_sha256) then
    raise exception 'outdated_legal_documents' using errcode = 'P0001';
  end if;

  if client_ip is not null then
    select count(*) into open_from_ip
      from public.orders o join public.consent_records r on r.order_id = o.id and r.document_slug = 'terms'
      where r.ip_address = client_ip and o.status = 'awaiting_payment' and o.expires_at > now();
    if open_from_ip >= 3 then
      raise exception 'too_many_open_orders' using errcode = 'P0001';
    end if;
  end if;
  if not public.rate_limit_allows(public.rate_limit_key('checkout', lower(btrim(coalesce(p_email, '')))), 'o checkout', 10, interval '1 hour') then
    raise exception 'too_many_attempts' using errcode = 'P0001';
  end if;

  placed := public.create_order(
    p_account_id, p_name, p_email, p_whatsapp, p_document, p_birth_date,
    p_instagram, p_city, p_state, p_payment_method, public.checkout_hold_minutes()
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

-- Página do pedido: limite de consultas para ninguém varrer códigos.
create or replace function public.get_order(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  clean_code text := upper(btrim(coalesce(p_code, '')));
  found_order public.orders;
begin
  if not public.rate_limit_allows(public.rate_limit_key('order-page', clean_code), 'a página do pedido', 60, interval '10 minutes') then
    raise exception 'too_many_attempts' using errcode = 'P0001';
  end if;
  select * into found_order from public.orders where code = clean_code;
  if not found then
    return null;
  end if;
  return public.public_order_json(found_order);
end;
$$;

revoke all on function public.get_order(text) from public;
grant execute on function public.get_order(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Administrador: duas etapas e sessão com prazo
-- ---------------------------------------------------------------------------

-- Quem ligou a verificação em duas etapas só vale como admin com o código conferido (aal2).
-- Sessão com mais de 7 dias, ou encerrada no "Sair" (a linha some de auth.sessions), deixa de valer na hora,
-- mesmo que o token de acesso ainda não tenha vencido.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users a
    join auth.sessions s on s.user_id = a.user_id
    where a.user_id = auth.uid()
      and s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid
      and s.created_at > now() - interval '7 days'
      and (
        coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
        or not exists (select 1 from auth.mfa_factors f where f.user_id = a.user_id and f.status = 'verified')
      )
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Políticas avaliadas uma vez por consulta
-- ---------------------------------------------------------------------------

alter policy "admins read admin list" on public.admin_users using ((select public.is_admin()));
alter policy "admins insert accounts" on public.accounts with check ((select public.is_admin()));
alter policy "admins update accounts" on public.accounts using ((select public.is_admin())) with check ((select public.is_admin()));
alter policy "admins delete accounts" on public.accounts using ((select public.is_admin()));
alter policy "anyone reads published testimonials" on public.testimonials using (published or (select public.is_admin()));
alter policy "admins insert testimonials" on public.testimonials with check ((select public.is_admin()));
alter policy "admins update testimonials" on public.testimonials using ((select public.is_admin())) with check ((select public.is_admin()));
alter policy "admins delete testimonials" on public.testimonials using ((select public.is_admin()));
alter policy "admins read orders" on public.orders using ((select public.is_admin()));
alter policy "admins update orders" on public.orders using ((select public.is_admin())) with check ((select public.is_admin()));
alter policy "admins update store settings" on public.store_settings using ((select public.is_admin())) with check ((select public.is_admin()));
alter policy "admins read leads" on public.leads using ((select public.is_admin()));
alter policy "admins insert leads" on public.leads with check ((select public.is_admin()));
alter policy "admins update leads" on public.leads using ((select public.is_admin())) with check ((select public.is_admin()));
alter policy "admins delete leads" on public.leads using ((select public.is_admin()));
alter policy "admins read customers" on public.customers using ((select public.is_admin()));
alter policy "admins insert customers" on public.customers with check ((select public.is_admin()));
alter policy "admins update customers" on public.customers using ((select public.is_admin())) with check ((select public.is_admin()));
alter policy "admins delete customers" on public.customers using ((select public.is_admin()));
alter policy "admins read message templates" on public.message_templates using ((select public.is_admin()));
alter policy "admins insert message templates" on public.message_templates with check ((select public.is_admin()));
alter policy "admins update message templates" on public.message_templates using ((select public.is_admin())) with check ((select public.is_admin()));
alter policy "admins read preferences" on public.admin_preferences using ((select public.is_admin()));
alter policy "admins insert preferences" on public.admin_preferences with check ((select public.is_admin()));
alter policy "admins update preferences" on public.admin_preferences using ((select public.is_admin())) with check ((select public.is_admin()));
alter policy "admins read expenses" on public.expenses using ((select public.is_admin()));
alter policy "admins insert expenses" on public.expenses with check ((select public.is_admin()));
alter policy "admins update expenses" on public.expenses using ((select public.is_admin())) with check ((select public.is_admin()));
alter policy "admins delete expenses" on public.expenses using ((select public.is_admin()));
alter policy "admins read partners" on public.partners using ((select public.is_admin()));
alter policy "admins insert partners" on public.partners with check ((select public.is_admin()));
alter policy "admins update partners" on public.partners using ((select public.is_admin())) with check ((select public.is_admin()));
alter policy "admins delete partners" on public.partners using ((select public.is_admin()));
alter policy "admins read notifications" on public.notifications using ((select public.is_admin()));
alter policy "admins read own dismissals" on public.notification_dismissals using (user_id = (select auth.uid()) and (select public.is_admin()));
alter policy "admins insert own dismissals" on public.notification_dismissals with check (user_id = (select auth.uid()) and (select public.is_admin()));
alter policy "admins delete own dismissals" on public.notification_dismissals using (user_id = (select auth.uid()) and (select public.is_admin()));
alter policy "admins read revenues" on public.revenues using ((select public.is_admin()));
alter policy "admins insert revenues" on public.revenues with check ((select public.is_admin()));
alter policy "admins update revenues" on public.revenues using ((select public.is_admin())) with check ((select public.is_admin()));
alter policy "admins delete revenues" on public.revenues using ((select public.is_admin()));
alter policy "admins insert site content" on public.site_content with check ((select public.is_admin()));
alter policy "admins update site content" on public.site_content using ((select public.is_admin())) with check ((select public.is_admin()));
alter policy "admins read consent records" on public.consent_records using ((select public.is_admin()));
alter policy "admins read data requests" on public.data_requests using ((select public.is_admin()));
alter policy "admins answer data requests" on public.data_requests using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- 7. Vitrine sem o parceiro de cada conta
-- ---------------------------------------------------------------------------

revoke all on public.accounts from anon;
grant select (
  id, slug, platform, display_name, handle, niche, followers, price_cents, status, reserved_until,
  description, images, stats, listed_at, created_at, updated_at, avatar_url, profile_url
) on public.accounts to anon;

-- ---------------------------------------------------------------------------
-- 8. Tabela nova nasce protegida
-- ---------------------------------------------------------------------------

-- A migration table_grants abria toda tabela futura para a chave anon. Agora tabela pública declara o próprio grant.
alter default privileges in schema public revoke select, insert, update, delete on tables from anon;

create or replace function public.enforce_rls_on_new_tables()
returns event_trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  created record;
begin
  for created in
    select * from pg_event_trigger_ddl_commands()
    where object_type = 'table' and schema_name = 'public'
  loop
    execute format('alter table %s enable row level security', created.object_identity);
  end loop;
end;
$$;

revoke all on function public.enforce_rls_on_new_tables() from public, anon, authenticated;

create event trigger enforce_rls_on_new_tables on ddl_command_end
  when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  execute function public.enforce_rls_on_new_tables();

-- ---------------------------------------------------------------------------
-- 9. Auditoria e avisos de segurança
-- ---------------------------------------------------------------------------

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null check (char_length(action) between 1 and 40),
  entity text not null check (char_length(entity) between 1 and 60),
  entity_id text check (entity_id is null or char_length(entity_id) <= 100),
  details jsonb not null default '{}' check (jsonb_typeof(details) = 'object'),
  ip_address text check (ip_address is null or char_length(ip_address) <= 64),
  created_at timestamptz not null default now()
);

create index audit_events_created_idx on public.audit_events (created_at desc);

alter table public.audit_events enable row level security;

create policy "admins read audit events" on public.audit_events
  for select to authenticated using ((select public.is_admin()));

-- Ninguém grava, altera ou apaga pelo painel: só os gatilhos e funções abaixo.
revoke all on public.audit_events from anon;
revoke insert, update, delete, truncate on public.audit_events from authenticated;
grant select on public.audit_events to authenticated;

create or replace function public.record_audit(p_action text, p_entity text, p_entity_id text, p_details jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_events (actor_id, action, entity, entity_id, details, ip_address)
  values (auth.uid(), p_action, p_entity, left(p_entity_id, 100), coalesce(p_details, '{}'), left(public.request_ip(), 64));
$$;

revoke all on function public.record_audit(text, text, text, jsonb) from public, anon, authenticated;

/** Exclusões, troca de status de pedido, preço de conta e textos da loja. Guarda só o id, nunca o dado apagado. */
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data jsonb;
  details jsonb := '{}';
begin
  if tg_op = 'DELETE' then
    row_data := to_jsonb(old);
  else
    row_data := to_jsonb(new);
  end if;
  if tg_table_name = 'orders' then
    details := jsonb_build_object('code', row_data ->> 'code', 'from', to_jsonb(old) ->> 'status', 'to', row_data ->> 'status');
  elsif tg_table_name = 'accounts' and tg_op = 'UPDATE' then
    details := jsonb_build_object('handle', row_data ->> 'handle', 'from', to_jsonb(old) ->> 'price_cents', 'to', row_data ->> 'price_cents');
  elsif tg_table_name = 'data_requests' then
    details := jsonb_build_object('protocol', row_data ->> 'protocol', 'status', row_data ->> 'status');
  end if;
  perform public.record_audit(
    lower(tg_op),
    tg_table_name,
    coalesce(row_data ->> 'id', row_data ->> 'user_id', row_data ->> 'key'),
    details
  );
  return null;
end;
$$;

revoke all on function public.audit_row_change() from public, anon, authenticated;

create trigger audit_delete after delete on public.accounts for each row execute function public.audit_row_change();
create trigger audit_delete after delete on public.testimonials for each row execute function public.audit_row_change();
create trigger audit_delete after delete on public.leads for each row execute function public.audit_row_change();
create trigger audit_delete after delete on public.customers for each row execute function public.audit_row_change();
create trigger audit_delete after delete on public.partners for each row execute function public.audit_row_change();
create trigger audit_delete after delete on public.expenses for each row execute function public.audit_row_change();
create trigger audit_delete after delete on public.revenues for each row execute function public.audit_row_change();
create trigger audit_status after update of status on public.orders
  for each row when (old.status is distinct from new.status) execute function public.audit_row_change();
create trigger audit_price after update of price_cents on public.accounts
  for each row when (old.price_cents is distinct from new.price_cents) execute function public.audit_row_change();
create trigger audit_update after update on public.store_settings for each row execute function public.audit_row_change();
create trigger audit_update after update on public.site_content for each row execute function public.audit_row_change();
create trigger audit_update after update on public.message_templates for each row execute function public.audit_row_change();
create trigger audit_update after update on public.data_requests for each row execute function public.audit_row_change();

/** Usuário com acesso ao painel criado ou removido: registro e aviso no sininho. */
create or replace function public.audit_admin_users_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_id uuid;
  who text;
begin
  if tg_op = 'DELETE' then
    changed_id := old.user_id;
  else
    changed_id := new.user_id;
  end if;
  select coalesce(email, changed_id::text) into who from auth.users where id = changed_id;
  perform public.record_audit(case when tg_op = 'DELETE' then 'admin_removed' else 'admin_added' end, 'admin_users', changed_id::text, '{}');
  insert into public.notifications (kind, title, body, link) values (
    'security',
    case when tg_op = 'DELETE' then 'Acesso ao painel removido' else 'Novo acesso ao painel criado' end,
    coalesce(who, changed_id::text) || case when tg_op = 'DELETE' then ' não entra mais no sistema.' else ' agora entra no sistema.' end,
    '/admin/usuarios'
  );
  return null;
end;
$$;

revoke all on function public.audit_admin_users_change() from public, anon, authenticated;

create trigger audit_admin_users after insert or delete on public.admin_users
  for each row execute function public.audit_admin_users_change();

/**
 * Cada login de administrador fica registrado e avisa no sininho de todos.
 * O login nunca pode falhar por causa do aviso: um erro aqui vira alerta no log do banco e o login segue.
 */
create or replace function public.audit_admin_login()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  who text;
begin
  select coalesce(a.name, u.email) into who
    from public.admin_users a join auth.users u on u.id = a.user_id
    where a.user_id = new.user_id;
  if who is null then
    return new;
  end if;
  insert into public.audit_events (actor_id, action, entity, entity_id, details, ip_address)
  values (
    new.user_id, 'login', 'auth.sessions', new.id::text,
    jsonb_build_object('user_agent', left(to_jsonb(new) ->> 'user_agent', 400)),
    left(to_jsonb(new) ->> 'ip', 64)
  );
  insert into public.notifications (kind, title, body, link) values (
    'security',
    'Novo login no painel',
    who || ' entrou em ' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI')
      || '. Se não foi você, troque a senha e ligue a verificação em duas etapas.',
    '/admin/configuracoes'
  );
  return new;
exception when others then
  raise warning 'audit_admin_login falhou: %', sqlerrm;
  return new;
end;
$$;

revoke all on function public.audit_admin_login() from public, anon, authenticated;

do $$
begin
  create trigger audit_admin_login after insert on auth.sessions
    for each row execute function public.audit_admin_login();
exception when insufficient_privilege then
  raise warning 'Sem permissão para criar o gatilho em auth.sessions: o aviso de login fica desligado.';
end;
$$;

-- Anonimização e retenção ficam registradas. Do titular anonimizado guarda só a impressão digital do e-mail.
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
  result jsonb;
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

  result := jsonb_build_object('anonymized_orders', anonymized, 'kept_orders', kept, 'deleted_customers', deleted_customers);
  perform public.record_audit('anonymize', 'data_subject', public.hash_pii(clean_email), result);
  return result;
end;
$$;

revoke all on function public.anonymize_data_subject(text) from public, anon;
grant execute on function public.anonymize_data_subject(text) to authenticated;

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
    where customer_email not like '%@anonimizado.invalid'
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

revoke all on function public.run_retention_policy() from public, anon, authenticated;

create or replace function public.apply_retention_policy()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  result := public.run_retention_policy();
  perform public.record_audit('retention', 'retention_policy', null, result);
  return result;
end;
$$;

revoke all on function public.apply_retention_policy() from public, anon;
grant execute on function public.apply_retention_policy() to authenticated;
