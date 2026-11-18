-- Programa de afiliados (Aditivo 01, Anexo I, item 2).
--
-- Afiliado é diferente de parceiro: parceiro fornece contas; afiliado divulga as contas da loja com link ou cupom
-- próprio, tem login e ganha comissão em nível único sobre a venda paga (cláusula 4.1 do aditivo).
--
-- Como a venda chega ao afiliado:
--   link   o site chama track_affiliate_click ao abrir ?ref=<código>, guarda o clique por `link_days` e, logo depois
--          de criar o pedido, chama attach_affiliate_click com o código do pedido.
--   cupom  cupom com affiliate_id. O cupom vence o link: é a escolha explícita do cliente.
-- A comissão nasce quando o pedido vira pago, fica pendente até a garantia acabar (release_at) e é cancelada
-- sozinha se o pedido for cancelado. Compra feita com o CPF do próprio afiliado nasce cancelada.

-- ---------------------------------------------------------------------------
-- 1. Regras do programa (linha única, editada pelo Jota na aba Parceiros)
-- ---------------------------------------------------------------------------

create table public.affiliate_program (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  -- Cadastro novo já entra aprovado; desligado, o Jota aprova um a um.
  auto_approve boolean not null default false,
  commission_kind text not null default 'percent' check (commission_kind in ('percent', 'fixed')),
  -- percent: 1 a 90 (%); fixed: centavos.
  commission_value integer not null default 10,
  link_days integer not null default 30 check (link_days between 1 and 365),
  min_withdrawal_cents integer not null default 5000 check (min_withdrawal_cents between 100 and 10000000),
  daily_auto_limit_cents integer not null default 50000 check (daily_auto_limit_cents between 0 and 100000000),
  manual_approval_above_cents integer not null default 20000 check (manual_approval_above_cents between 0 and 100000000),
  terms text not null default '' check (char_length(terms) <= 20000),
  welcome_text text check (welcome_text is null or char_length(welcome_text) <= 2000),
  updated_at timestamptz not null default now(),
  constraint affiliate_program_commission check (
    (commission_kind = 'percent' and commission_value between 1 and 90)
    or (commission_kind = 'fixed' and commission_value between 100 and 10000000)
  )
);

insert into public.affiliate_program default values;

create trigger affiliate_program_touch before update on public.affiliate_program
  for each row execute function public.touch_updated_at();

alter table public.affiliate_program enable row level security;

-- Nada de sigiloso: a página "Seja afiliado" mostra a comissão e os termos.
create policy "anyone reads affiliate program" on public.affiliate_program
  for select to anon, authenticated using (true);

create policy "partners staff update affiliate program" on public.affiliate_program
  for update to authenticated
  using ((select public.has_permission('partners'))) with check ((select public.has_permission('partners')));

revoke all on public.affiliate_program from anon, authenticated;
grant select on public.affiliate_program to anon, authenticated;
grant update (
  enabled, auto_approve, commission_kind, commission_value, link_days, min_withdrawal_cents,
  daily_auto_limit_cents, manual_approval_above_cents, terms, welcome_text
) on public.affiliate_program to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Afiliados
-- ---------------------------------------------------------------------------

create table public.affiliates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  -- Vai no link: jotadigitais.com.br/?ref=<code>.
  code text not null unique check (code ~ '^[a-z0-9]{4,20}$'),
  name text not null check (char_length(name) between 2 and 80),
  email text not null check (char_length(email) between 3 and 254),
  whatsapp text check (whatsapp is null or whatsapp ~ '^[0-9]{10,13}$'),
  -- Entrada só: o gatilho cifra e apaga o número aberto antes de gravar (igual a pedidos e clientes).
  document text,
  document_encrypted bytea,
  document_hash text,
  pix_key text check (pix_key is null or char_length(pix_key) between 1 and 140),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'suspended', 'blocked')),
  status_note text check (status_note is null or char_length(status_note) <= 500),
  partner_id uuid references public.partners (id) on delete set null,
  terms_accepted_at timestamptz not null,
  terms_sha256 text not null check (terms_sha256 ~ '^[0-9a-f]{64}$'),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index affiliates_status_idx on public.affiliates (status);
create index affiliates_partner_idx on public.affiliates (partner_id) where partner_id is not null;

create trigger affiliates_touch before update on public.affiliates
  for each row execute function public.touch_updated_at();

/** Afiliado recebe como pessoa física: só CPF (11 números com dígito verificador). */
create or replace function public.is_valid_affiliate_cpf(p_digits text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_digits ~ '^\d{11}$' and public.is_valid_document(p_digits), false);
$$;

create or replace function public.encrypt_affiliate_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.document is null then
    if tg_op = 'INSERT' then
      new.document_encrypted := null;
      new.document_hash := null;
    end if;
    return new;
  end if;
  new.document := regexp_replace(new.document, '\D', '', 'g');
  if not public.is_valid_affiliate_cpf(new.document) then
    raise exception 'invalid_document' using errcode = 'P0001';
  end if;
  new.document_encrypted := public.encrypt_pii(new.document);
  new.document_hash := public.hash_pii(new.document);
  new.document := null;
  return new;
end;
$$;

revoke all on function public.encrypt_affiliate_document() from public, anon, authenticated;

create trigger affiliates_encrypt_document before insert or update of document on public.affiliates
  for each row execute function public.encrypt_affiliate_document();

create or replace function public.stamp_affiliate_approval()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status <> 'approved') then
    new.approved_at := now();
  end if;
  return new;
end;
$$;

create trigger affiliates_stamp_approval before insert or update of status on public.affiliates
  for each row execute function public.stamp_affiliate_approval();

/** Afiliado da sessão (qualquer situação). Nulo para quem não é afiliado. */
create or replace function public.current_affiliate_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select a.id from public.affiliates a where a.user_id = auth.uid();
$$;

/** Afiliado aprovado da sessão: só ele vê vitrine, mural e ranking. */
create or replace function public.current_approved_affiliate_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select a.id from public.affiliates a where a.user_id = auth.uid() and a.status = 'approved';
$$;

revoke all on function public.current_affiliate_id() from public;
revoke all on function public.current_approved_affiliate_id() from public;
grant execute on function public.current_affiliate_id() to authenticated;
grant execute on function public.current_approved_affiliate_id() to authenticated;

/**
 * CPF aberto de um afiliado: para ele mesmo e para o Jota. A desenvolvedora não vê (mesma regra dos clientes).
 * Função por id (e não coluna calculada) porque a linha inteira inclui o CPF cifrado, que ninguém lê direto.
 */
create or replace function public.affiliate_document_of(p_affiliate_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select public.decrypt_pii(a.document_encrypted)
  from public.affiliates a
  where a.id = p_affiliate_id
    and (
      a.user_id = auth.uid()
      or (public.has_permission('partners') and coalesce(public.current_admin_role(), '') <> 'developer')
    );
$$;

revoke all on function public.affiliate_document_of(uuid) from public, anon;
grant execute on function public.affiliate_document_of(uuid) to authenticated;

alter table public.affiliates enable row level security;

create policy "partners staff read affiliates" on public.affiliates
  for select to authenticated using ((select public.has_permission('partners')));
create policy "affiliate reads self" on public.affiliates
  for select to authenticated using (user_id = (select auth.uid()));
-- O Jota só mexe na situação, na observação e no parceiro ligado. Dados pessoais o afiliado troca pela função.
create policy "partners staff update affiliates" on public.affiliates
  for update to authenticated
  using ((select public.has_permission('partners'))) with check ((select public.has_permission('partners')));
create policy "partners staff delete affiliates" on public.affiliates
  for delete to authenticated using ((select public.has_permission('partners')));

revoke all on public.affiliates from anon, authenticated;
grant select (
  id, user_id, code, name, email, whatsapp, pix_key, status, status_note, partner_id,
  terms_accepted_at, approved_at, created_at, updated_at
) on public.affiliates to authenticated;
grant update (status, status_note, partner_id) on public.affiliates to authenticated;
grant delete on public.affiliates to authenticated;

create trigger audit_delete after delete on public.affiliates for each row execute function public.audit_row_change();

/** Código do link: primeiro nome sem acento + 3 caracteres, até achar um livre. */
create or replace function public.new_affiliate_code(p_name text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  base text := left(regexp_replace(lower(translate(split_part(btrim(p_name), ' ', 1), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ', 'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn')), '[^a-z0-9]', '', 'g'), 12);
  candidate text;
begin
  if char_length(base) < 2 then
    base := 'afiliado';
  end if;
  loop
    candidate := base || substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 3);
    exit when not exists (select 1 from public.affiliates a where a.code = candidate);
  end loop;
  return candidate;
end;
$$;

revoke all on function public.new_affiliate_code(text) from public, anon, authenticated;

/**
 * Cadastro do afiliado. Só a Edge Function affiliate-signup chama (chave de serviço), depois de criar o login.
 * Confere o programa ligado, o limite por IP, o CPF e o aceite da versão atual dos termos.
 */
create or replace function public.register_affiliate(
  p_user_id uuid,
  p_name text,
  p_email text,
  p_whatsapp text,
  p_document text,
  p_terms_sha256 text,
  p_ip text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  program public.affiliate_program;
  clean_name text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  clean_whatsapp text := nullif(regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g'), '');
  created public.affiliates;
begin
  select * into program from public.affiliate_program;
  if not program.enabled then
    raise exception 'program_closed' using errcode = 'P0001';
  end if;
  if p_terms_sha256 is distinct from encode(extensions.digest(program.terms, 'sha256'), 'hex') then
    raise exception 'outdated_terms' using errcode = 'P0001';
  end if;
  if not public.rate_limit_allows('affiliate-signup:' || coalesce('ip:' || nullif(p_ip, ''), 'id:' || p_email), 'o cadastro de afiliados', 5, interval '1 hour') then
    raise exception 'too_many_attempts' using errcode = 'P0001';
  end if;
  if not public.is_valid_affiliate_cpf(regexp_replace(coalesce(p_document, ''), '\D', '', 'g')) then
    raise exception 'invalid_document' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.affiliates a where a.document_hash = public.hash_pii(regexp_replace(p_document, '\D', '', 'g'))) then
    raise exception 'document_taken' using errcode = 'P0001';
  end if;

  insert into public.affiliates (user_id, code, name, email, whatsapp, document, status, terms_accepted_at, terms_sha256)
  values (
    p_user_id, public.new_affiliate_code(clean_name), clean_name, lower(btrim(p_email)), clean_whatsapp, p_document,
    case when program.auto_approve then 'approved' else 'pending' end, now(), p_terms_sha256
  )
  returning * into created;

  insert into public.notifications (kind, title, body, link)
  values (
    'news',
    case when created.status = 'approved' then 'Novo afiliado' else 'Afiliado esperando aprovação' end,
    created.name || ' se cadastrou no programa de afiliados.',
    '/admin/parceiros?aba=afiliados'
  );

  return jsonb_build_object('id', created.id, 'status', created.status, 'code', created.code);
end;
$$;

revoke all on function public.register_affiliate(uuid, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.register_affiliate(uuid, text, text, text, text, text, text) to service_role;

/** O afiliado troca os próprios dados. CPF já gravado só troca para outro válido que ninguém use. */
create or replace function public.update_my_affiliate_profile(p_name text, p_whatsapp text, p_document text, p_pix_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.current_affiliate_id();
  clean_name text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  clean_document text := nullif(regexp_replace(coalesce(p_document, ''), '\D', '', 'g'), '');
begin
  if me is null then
    raise exception 'not_affiliate' using errcode = '42501';
  end if;
  if clean_document is not null then
    if not public.is_valid_affiliate_cpf(clean_document) then
      raise exception 'invalid_document' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.affiliates a where a.id <> me and a.document_hash = public.hash_pii(clean_document)) then
      raise exception 'document_taken' using errcode = 'P0001';
    end if;
  end if;

  update public.affiliates
    set name = clean_name,
        whatsapp = nullif(regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g'), ''),
        pix_key = nullif(btrim(coalesce(p_pix_key, '')), '')
    where id = me;
  if clean_document is not null then
    update public.affiliates set document = clean_document where id = me;
  end if;
end;
$$;

revoke all on function public.update_my_affiliate_profile(text, text, text, text) from public, anon;
grant execute on function public.update_my_affiliate_profile(text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Conta liberada para afiliados e comissão própria
-- ---------------------------------------------------------------------------

alter table public.accounts
  add column affiliate_enabled boolean not null default true,
  add column affiliate_commission_kind text check (affiliate_commission_kind in ('percent', 'fixed')),
  add column affiliate_commission_value integer,
  add constraint accounts_affiliate_commission check (
    (affiliate_commission_kind is null and affiliate_commission_value is null)
    or (affiliate_commission_kind = 'percent' and affiliate_commission_value between 1 and 90)
    or (affiliate_commission_kind = 'fixed' and affiliate_commission_value between 100 and 10000000)
  );

/** Comissão de uma venda: porcentagem arredondada ou valor fixo, nunca acima do que o cliente pagou. */
create or replace function public.affiliate_commission_cents(p_kind text, p_value integer, p_base integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select greatest(0, least(
    case p_kind when 'percent' then round(p_base::numeric * p_value / 100)::integer else p_value end,
    p_base
  ));
$$;

/** Contas que o afiliado aprovado pode divulgar, com a comissão de cada uma no preço atual. */
create or replace function public.affiliate_account_commissions()
returns table (account_id uuid, commission_cents integer)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id,
    public.affiliate_commission_cents(
      coalesce(a.affiliate_commission_kind, p.commission_kind),
      coalesce(a.affiliate_commission_value, p.commission_value),
      a.price_cents
    )
  from public.accounts a cross join public.affiliate_program p
  where public.current_approved_affiliate_id() is not null
    and p.enabled
    and a.affiliate_enabled
    and a.status <> 'sold';
$$;

revoke all on function public.affiliate_account_commissions() from public, anon;
grant execute on function public.affiliate_account_commissions() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Cliques e ligação do pedido
-- ---------------------------------------------------------------------------

create table public.affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates (id) on delete cascade,
  account_id uuid references public.accounts (id) on delete set null,
  created_at timestamptz not null default now()
);

create index affiliate_clicks_affiliate_idx on public.affiliate_clicks (affiliate_id, created_at desc);

alter table public.affiliate_clicks enable row level security;

create policy "partners staff read clicks" on public.affiliate_clicks
  for select to authenticated using ((select public.has_permission('partners')));
create policy "affiliate reads own clicks" on public.affiliate_clicks
  for select to authenticated using (affiliate_id = (select public.current_affiliate_id()));

revoke all on public.affiliate_clicks from anon, authenticated;
grant select on public.affiliate_clicks to authenticated;

alter table public.orders
  add column affiliate_id uuid references public.affiliates (id) on delete set null,
  add column affiliate_click_id uuid references public.affiliate_clicks (id) on delete set null;

create index orders_affiliate_idx on public.orders (affiliate_id) where affiliate_id is not null;

alter table public.coupons
  add column affiliate_id uuid references public.affiliates (id) on delete set null;

create index coupons_affiliate_idx on public.coupons (affiliate_id) where affiliate_id is not null;

/**
 * Visitante abriu um link de afiliado. Devolve o id do clique, que o site guarda por `link_days` e manda junto
 * com o pedido. Código desconhecido, afiliado não aprovado ou programa desligado = nulo, sem erro.
 */
create or replace function public.track_affiliate_click(p_code text, p_account_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  program public.affiliate_program;
  owner uuid;
  click uuid;
begin
  select * into program from public.affiliate_program;
  if not program.enabled then
    return null;
  end if;
  select a.id into owner from public.affiliates a where a.code = lower(btrim(coalesce(p_code, ''))) and a.status = 'approved';
  if owner is null then
    return null;
  end if;
  if not public.rate_limit_allows(public.rate_limit_key('affiliate-click', p_code), 'os links de afiliado', 120, interval '1 hour') then
    return null;
  end if;
  insert into public.affiliate_clicks (affiliate_id, account_id)
  values (owner, (select a.id from public.accounts a where a.slug = p_account_slug))
  returning id into click;
  return jsonb_build_object('click_id', click, 'link_days', program.link_days);
end;
$$;

revoke all on function public.track_affiliate_click(text, text) from public;
grant execute on function public.track_affiliate_click(text, text) to anon, authenticated;

/**
 * Liga o pedido recém-criado ao clique do afiliado. Só vale nos primeiros 15 minutos do pedido, com o pagamento
 * em aberto, sem afiliado ainda e com o clique dentro do prazo. No carrinho, liga todos os pedidos dele.
 */
create or replace function public.attach_affiliate_click(p_order_code text, p_click_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  click public.affiliate_clicks;
  days integer;
  touched integer;
begin
  select link_days into days from public.affiliate_program;
  select * into click from public.affiliate_clicks c where c.id = p_click_id and c.created_at > now() - make_interval(days => days);
  if click.id is null then
    return false;
  end if;
  update public.orders o
    set affiliate_id = click.affiliate_id, affiliate_click_id = click.id
    where (o.code = p_order_code or o.cart_code = p_order_code)
      and o.status = 'awaiting_payment'
      and o.affiliate_id is null
      and o.created_at > now() - interval '15 minutes';
  get diagnostics touched = row_count;
  return touched > 0;
end;
$$;

revoke all on function public.attach_affiliate_click(text, uuid) from public;
grant execute on function public.attach_affiliate_click(text, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Comissões
-- ---------------------------------------------------------------------------

create table public.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  affiliate_id uuid not null references public.affiliates (id) on delete cascade,
  via text not null check (via in ('link', 'coupon')),
  order_code text not null,
  account_handle text,
  account_platform text,
  base_cents integer not null check (base_cents >= 0),
  amount_cents integer not null check (amount_cents >= 0),
  -- Liberada = pending com release_at no passado (a garantia acabou). paid entra com os saques.
  status text not null default 'pending' check (status in ('pending', 'canceled', 'paid')),
  release_at timestamptz,
  canceled_reason text check (canceled_reason in ('order_canceled', 'self_purchase', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint affiliate_commissions_reason check ((status = 'canceled') = (canceled_reason is not null))
);

create index affiliate_commissions_affiliate_idx on public.affiliate_commissions (affiliate_id, created_at desc);

create trigger affiliate_commissions_touch before update on public.affiliate_commissions
  for each row execute function public.touch_updated_at();

alter table public.affiliate_commissions enable row level security;

create policy "partners staff read commissions" on public.affiliate_commissions
  for select to authenticated using ((select public.has_permission('partners')));
create policy "affiliate reads own commissions" on public.affiliate_commissions
  for select to authenticated using (affiliate_id = (select public.current_affiliate_id()));

revoke all on public.affiliate_commissions from anon, authenticated;
grant select on public.affiliate_commissions to authenticated;

/**
 * Pago: cria a comissão (cupom do afiliado vence o link). Entregue: marca quando libera (fim da garantia).
 * Cancelado: cancela a pendente. Roda em cada pedido do carrinho, que muda de status junto com o principal.
 */
create or replace function public.affiliate_commission_on_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  program public.affiliate_program;
  owner public.affiliates;
  via text;
  coupon_owner uuid;
  account public.accounts;
  amount integer;
begin
  if new.status = 'paid' then
    select * into program from public.affiliate_program;
    if not program.enabled then
      return null;
    end if;

    select c.affiliate_id into coupon_owner
      from public.orders lead_order join public.coupons c on c.id = lead_order.coupon_id
      where lead_order.code = coalesce(new.cart_code, new.code);
    via := case when coupon_owner is not null then 'coupon' else 'link' end;
    select * into owner from public.affiliates a where a.id = coalesce(coupon_owner, new.affiliate_id);
    if owner.id is null or owner.status <> 'approved' then
      return null;
    end if;

    select * into account from public.accounts a where a.id = new.account_id;
    if account.id is not null and not account.affiliate_enabled then
      return null;
    end if;

    amount := public.affiliate_commission_cents(
      coalesce(account.affiliate_commission_kind, program.commission_kind),
      coalesce(account.affiliate_commission_value, program.commission_value),
      new.total_cents
    );
    if amount <= 0 then
      return null;
    end if;

    insert into public.affiliate_commissions (
      order_id, affiliate_id, via, order_code, account_handle, account_platform, base_cents, amount_cents, status, canceled_reason
    )
    values (
      new.id, owner.id, via, new.code, new.account_handle, new.account_platform::text, new.total_cents, amount,
      case when owner.document_hash is not null and owner.document_hash = new.customer_document_hash then 'canceled' else 'pending' end,
      case when owner.document_hash is not null and owner.document_hash = new.customer_document_hash then 'self_purchase' end
    )
    on conflict (order_id) do nothing;
  elsif new.status = 'delivered' then
    update public.affiliate_commissions c
      set release_at = coalesce(new.delivered_at, now()) + make_interval(days => (select s.guarantee_days from public.store_settings s))
      where c.order_id = new.id and c.status = 'pending';
  elsif new.status = 'canceled' then
    update public.affiliate_commissions c
      set status = 'canceled', canceled_reason = 'order_canceled'
      where c.order_id = new.id and c.status = 'pending';
  end if;
  return null;
end;
$$;

revoke all on function public.affiliate_commission_on_status() from public, anon, authenticated;

create trigger orders_affiliate_commission after update of status on public.orders
  for each row
  when (old.status is distinct from new.status)
  execute function public.affiliate_commission_on_status();

/** O Jota cancela uma comissão pendente à mão (ex.: venda devolvida fora do sistema). */
create or replace function public.cancel_affiliate_commission(p_commission_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('partners') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.affiliate_commissions
    set status = 'canceled', canceled_reason = 'manual'
    where id = p_commission_id and status = 'pending';
  if not found then
    raise exception 'commission_not_pending' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.cancel_affiliate_commission(uuid) from public, anon;
grant execute on function public.cancel_affiliate_commission(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Mural, ranking e números
-- ---------------------------------------------------------------------------

create table public.affiliate_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 120),
  body text not null check (char_length(body) between 1 and 4000),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger affiliate_announcements_touch before update on public.affiliate_announcements
  for each row execute function public.touch_updated_at();

alter table public.affiliate_announcements enable row level security;

create policy "staff and approved affiliates read announcements" on public.affiliate_announcements
  for select to authenticated
  using ((select public.has_permission('partners')) or (select public.current_approved_affiliate_id()) is not null);
create policy "partners staff insert announcements" on public.affiliate_announcements
  for insert to authenticated with check ((select public.has_permission('partners')));
create policy "partners staff update announcements" on public.affiliate_announcements
  for update to authenticated
  using ((select public.has_permission('partners'))) with check ((select public.has_permission('partners')));
create policy "partners staff delete announcements" on public.affiliate_announcements
  for delete to authenticated using ((select public.has_permission('partners')));

revoke all on public.affiliate_announcements from anon, authenticated;
grant select on public.affiliate_announcements to authenticated;
grant insert (title, body, pinned), update (title, body, pinned), delete on public.affiliate_announcements to authenticated;

/**
 * Quem mais vendeu nos últimos `p_days` dias (comissões não canceladas). Para o afiliado aparece só o primeiro
 * nome e a inicial do sobrenome; `is_me` marca a linha dele.
 */
create or replace function public.affiliate_ranking(p_days integer)
returns table (rank integer, display_name text, sales integer, is_me boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with totals as (
    select c.affiliate_id, count(*)::integer as sales, sum(c.amount_cents) as earned
    from public.affiliate_commissions c
    where c.status <> 'canceled' and c.created_at > now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 365))
    group by c.affiliate_id
  )
  select
    (row_number() over (order by t.sales desc, t.earned desc, a.created_at))::integer,
    split_part(a.name, ' ', 1)
      || coalesce(' ' || nullif(left(split_part(a.name, ' ', 2), 1), '') || '.', ''),
    t.sales,
    a.id = public.current_affiliate_id()
  from totals t join public.affiliates a on a.id = t.affiliate_id
  where public.current_approved_affiliate_id() is not null or public.has_permission('partners')
  order by 1
  limit 10;
$$;

revoke all on function public.affiliate_ranking(integer) from public, anon;
grant execute on function public.affiliate_ranking(integer) to authenticated;

/** Cupom exclusivo do afiliado logado (o mais recente valendo), para o painel dele mostrar. */
create or replace function public.my_affiliate_coupon()
returns table (code text, kind text, value integer)
language sql
stable
security definer
set search_path = ''
as $$
  select c.code, c.kind, c.value
  from public.coupons c
  where c.affiliate_id = public.current_approved_affiliate_id()
    and c.active and (c.ends_at is null or c.ends_at > now())
  order by c.created_at desc
  limit 1;
$$;

revoke all on function public.my_affiliate_coupon() from public, anon;
grant execute on function public.my_affiliate_coupon() to authenticated;
