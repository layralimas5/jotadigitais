-- Programa de afiliados, entrega 2 (chamados "painel de afiliados" e "exemplos de ganhos", 25/11).
--
-- 1. Comissão própria por afiliado (o Jota prioriza quem está há mais tempo).
-- 2. Pagamento em lotes: o Jota paga a cada N indicações (padrão 10), marca "paguei" e o afiliado vê o que falta.
-- 3. Brindes: o Jota oferece, o afiliado toca em "Receber", o Jota marca como entregue.
-- 4. Faixa de chamada e números da loja no painel do afiliado (contas disponíveis, afiliados, mais vendidos).
-- 5. Indicação pelo WhatsApp: o link /indicacao/<código> abre o WhatsApp da loja com o código na mensagem. Quando a
--    conversa chega pelo número oficial, o contato fica marcado com o afiliado, e a compra desse número conta para ele.
-- 6. Venda atribuída à mão pelo Jota (cliente esqueceu o cupom ou veio indicado sem link).
-- 7. Avisos do afiliado: guarda até quando ele já viu, para o sininho do painel.

-- ---------------------------------------------------------------------------
-- 1. Programa e afiliado
-- ---------------------------------------------------------------------------

alter table public.affiliate_program
  add column payout_batch_size integer not null default 10 check (payout_batch_size between 1 and 100),
  add column banner_title text check (banner_title is null or char_length(banner_title) <= 120),
  add column banner_text text check (banner_text is null or char_length(banner_text) <= 500);

grant update (payout_batch_size, banner_title, banner_text) on public.affiliate_program to authenticated;

alter table public.affiliates
  add column commission_kind text check (commission_kind in ('percent', 'fixed')),
  add column commission_value integer,
  add column notifications_seen_at timestamptz,
  add constraint affiliates_commission check (
    (commission_kind is null and commission_value is null)
    or (commission_kind = 'percent' and commission_value between 1 and 90)
    or (commission_kind = 'fixed' and commission_value between 100 and 10000000)
  );

grant select (commission_kind, commission_value, notifications_seen_at) on public.affiliates to authenticated;

-- Afiliado que indicou o contato do WhatsApp oficial (seção 5).
alter table public.whatsapp_contacts
  add column affiliate_id uuid references public.affiliates (id) on delete set null,
  add column affiliate_referred_at timestamptz;

create index whatsapp_contacts_affiliate_idx on public.whatsapp_contacts (affiliate_id) where affiliate_id is not null;
grant update (commission_kind, commission_value) on public.affiliates to authenticated;

/** O afiliado marca os avisos como vistos (o sininho zera). */
create or replace function public.mark_affiliate_notifications_seen()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.affiliates set notifications_seen_at = now() where id = public.current_affiliate_id();
$$;

revoke all on function public.mark_affiliate_notifications_seen() from public, anon;
grant execute on function public.mark_affiliate_notifications_seen() to authenticated;

/**
 * Comissão de uma venda para um afiliado. A comissão própria do afiliado entra no lugar da padrão do programa.
 * Conta com comissão própria vale a da conta, a não ser que a do afiliado dê mais: o afiliado nunca sai perdendo.
 */
create or replace function public.affiliate_amount_for(p_affiliate_id uuid, p_account_id uuid, p_base integer)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  program public.affiliate_program;
  owner public.affiliates;
  account public.accounts;
  own_amount integer;
  account_amount integer;
begin
  select * into program from public.affiliate_program;
  select * into owner from public.affiliates a where a.id = p_affiliate_id;
  select * into account from public.accounts a where a.id = p_account_id;
  if owner.commission_kind is not null then
    own_amount := public.affiliate_commission_cents(owner.commission_kind, owner.commission_value, p_base);
  end if;
  if account.affiliate_commission_kind is not null then
    account_amount := public.affiliate_commission_cents(account.affiliate_commission_kind, account.affiliate_commission_value, p_base);
  end if;
  if own_amount is not null and account_amount is not null then
    return greatest(own_amount, account_amount);
  end if;
  return coalesce(account_amount, own_amount, public.affiliate_commission_cents(program.commission_kind, program.commission_value, p_base));
end;
$$;

revoke all on function public.affiliate_amount_for(uuid, uuid, integer) from public, anon, authenticated;

/** Contas que o afiliado aprovado pode divulgar, com a comissão dele em cada uma no preço atual. */
create or replace function public.affiliate_account_commissions()
returns table (account_id uuid, commission_cents integer)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, public.affiliate_amount_for(public.current_approved_affiliate_id(), a.id, a.price_cents)
  from public.accounts a cross join public.affiliate_program p
  where public.current_approved_affiliate_id() is not null
    and p.enabled
    and a.affiliate_enabled
    and a.status <> 'sold';
$$;

-- ---------------------------------------------------------------------------
-- 2. Comissão: novos caminhos (WhatsApp e à mão) e lote de pagamento
-- ---------------------------------------------------------------------------

create table public.affiliate_payouts (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates (id) on delete cascade,
  commissions_count integer not null check (commissions_count > 0),
  amount_cents integer not null check (amount_cents >= 0),
  -- Chave Pix usada no pagamento (a do perfil naquela hora).
  pix_key text check (pix_key is null or char_length(pix_key) <= 140),
  note text check (note is null or char_length(note) <= 500),
  paid_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);

create index affiliate_payouts_affiliate_idx on public.affiliate_payouts (affiliate_id, paid_at desc);

alter table public.affiliate_payouts enable row level security;

create policy "partners staff read payouts" on public.affiliate_payouts
  for select to authenticated using ((select public.has_permission('partners')));
create policy "affiliate reads own payouts" on public.affiliate_payouts
  for select to authenticated using (affiliate_id = (select public.current_affiliate_id()));

revoke all on public.affiliate_payouts from anon, authenticated;
grant select on public.affiliate_payouts to authenticated;

alter table public.affiliate_commissions
  add column payout_id uuid references public.affiliate_payouts (id) on delete set null,
  drop constraint affiliate_commissions_via_check,
  add constraint affiliate_commissions_via_check check (via in ('link', 'coupon', 'whatsapp', 'manual'));

create index affiliate_commissions_payout_idx on public.affiliate_commissions (payout_id) where payout_id is not null;

/** Cria a comissão de um pedido pago para um afiliado aprovado. Devolve falso quando não cabe comissão. */
create or replace function public.create_affiliate_commission(p_order public.orders, p_affiliate_id uuid, p_via text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner public.affiliates;
  account public.accounts;
  amount integer;
  self_purchase boolean;
begin
  select * into owner from public.affiliates a where a.id = p_affiliate_id;
  if owner.id is null or owner.status <> 'approved' then
    return false;
  end if;
  select * into account from public.accounts a where a.id = p_order.account_id;
  if account.id is not null and not account.affiliate_enabled then
    return false;
  end if;
  amount := public.affiliate_amount_for(owner.id, p_order.account_id, p_order.total_cents);
  if amount <= 0 then
    return false;
  end if;
  self_purchase := owner.document_hash is not null and owner.document_hash = p_order.customer_document_hash;

  insert into public.affiliate_commissions (
    order_id, affiliate_id, via, order_code, account_handle, account_platform, base_cents, amount_cents, status, canceled_reason, release_at
  )
  values (
    p_order.id, owner.id, p_via, p_order.code, p_order.account_handle, p_order.account_platform::text, p_order.total_cents, amount,
    case when self_purchase then 'canceled' else 'pending' end,
    case when self_purchase then 'self_purchase' end,
    case when p_order.status = 'delivered'
      then coalesce(p_order.delivered_at, now()) + make_interval(days => (select s.guarantee_days from public.store_settings s))
    end
  )
  on conflict (order_id) do nothing;
  return found;
end;
$$;

revoke all on function public.create_affiliate_commission(public.orders, uuid, text) from public, anon, authenticated;

/**
 * Indicação que chegou pelo WhatsApp oficial: o afiliado marcado no contato do mesmo número, dentro do prazo do
 * link. Nulo quando não há.
 */
create or replace function public.whatsapp_affiliate_for(p_phone text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.affiliate_id
  from public.whatsapp_contacts c cross join public.affiliate_program p
  where p_phone is not null
    and c.affiliate_id is not null
    and c.affiliate_referred_at > now() - make_interval(days => p.link_days)
    and public.whatsapp_phone_key(c.phone) = public.whatsapp_phone_key(p_phone)
  order by c.affiliate_referred_at desc
  limit 1;
$$;

revoke all on function public.whatsapp_affiliate_for(text) from public, anon, authenticated;

/**
 * Pago: cria a comissão. Ordem de quem leva: cupom do afiliado, depois o link, depois a indicação pelo WhatsApp.
 * Entregue: marca quando libera (fim da garantia). Cancelado: cancela a pendente.
 */
create or replace function public.affiliate_commission_on_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  program public.affiliate_program;
  coupon_owner uuid;
  whatsapp_owner uuid;
begin
  if new.status = 'paid' then
    select * into program from public.affiliate_program;
    if not program.enabled then
      return null;
    end if;

    select c.affiliate_id into coupon_owner
      from public.orders lead_order join public.coupons c on c.id = lead_order.coupon_id
      where lead_order.code = coalesce(new.cart_code, new.code);
    if coupon_owner is not null then
      perform public.create_affiliate_commission(new, coupon_owner, 'coupon');
    elsif new.affiliate_id is not null then
      perform public.create_affiliate_commission(new, new.affiliate_id, case when new.affiliate_click_id is null then 'manual' else 'link' end);
    else
      whatsapp_owner := public.whatsapp_affiliate_for(new.customer_whatsapp);
      if whatsapp_owner is not null then
        perform public.create_affiliate_commission(new, whatsapp_owner, 'whatsapp');
      end if;
    end if;
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

/**
 * O Jota diz de qual afiliado é a venda (cliente esqueceu o cupom, veio indicado sem link). Vale para o carrinho
 * todo. Pedido já pago ganha a comissão na hora; em aberto, ela nasce quando o pagamento cair.
 * Devolve quantas comissões foram criadas agora.
 */
create or replace function public.assign_order_affiliate(p_order_code text, p_affiliate_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.orders;
  created integer := 0;
begin
  if not public.has_permission('partners') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.affiliates a where a.id = p_affiliate_id and a.status = 'approved') then
    raise exception 'affiliate_not_approved' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.orders o where o.code = p_order_code or o.cart_code = p_order_code) then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.affiliate_commissions c join public.orders o on o.id = c.order_id
    where (o.code = p_order_code or o.cart_code = p_order_code) and c.status <> 'canceled'
  ) then
    raise exception 'order_has_affiliate' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.orders o where (o.code = p_order_code or o.cart_code = p_order_code) and o.status = 'canceled') then
    raise exception 'order_canceled' using errcode = 'P0001';
  end if;

  update public.orders o
    set affiliate_id = p_affiliate_id, affiliate_click_id = null
    where o.code = p_order_code or o.cart_code = p_order_code;

  for target in
    select * from public.orders o
    where (o.code = p_order_code or o.cart_code = p_order_code) and o.status in ('paid', 'delivered')
  loop
    delete from public.affiliate_commissions c where c.order_id = target.id and c.status = 'canceled';
    if public.create_affiliate_commission(target, p_affiliate_id, 'manual') then
      created := created + 1;
    end if;
  end loop;
  return created;
end;
$$;

revoke all on function public.assign_order_affiliate(text, uuid) from public, anon;
grant execute on function public.assign_order_affiliate(text, uuid) to authenticated;

/**
 * "Paguei": as comissões escolhidas (do mesmo afiliado, não canceladas nem pagas) viram um lote pago.
 * Devolve o id do lote.
 */
create or replace function public.pay_affiliate_commissions(p_affiliate_id uuid, p_commission_ids uuid[], p_note text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  payout uuid;
  picked integer;
  total integer;
begin
  if not public.has_permission('partners') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select count(*), coalesce(sum(c.amount_cents), 0) into picked, total
    from public.affiliate_commissions c
    where c.id = any (p_commission_ids) and c.affiliate_id = p_affiliate_id and c.status = 'pending';
  if picked = 0 or picked <> coalesce(array_length(p_commission_ids, 1), 0) then
    raise exception 'commissions_not_payable' using errcode = 'P0001';
  end if;

  insert into public.affiliate_payouts (affiliate_id, commissions_count, amount_cents, pix_key, note)
  values (
    p_affiliate_id, picked, total,
    (select a.pix_key from public.affiliates a where a.id = p_affiliate_id),
    nullif(left(btrim(coalesce(p_note, '')), 500), '')
  )
  returning id into payout;

  update public.affiliate_commissions c
    set status = 'paid', payout_id = payout
    where c.id = any (p_commission_ids);
  return payout;
end;
$$;

revoke all on function public.pay_affiliate_commissions(uuid, uuid[], text) from public, anon;
grant execute on function public.pay_affiliate_commissions(uuid, uuid[], text) to authenticated;

/** Desfaz um lote marcado por engano: as comissões voltam a esperar pagamento. */
create or replace function public.undo_affiliate_payout(p_payout_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('partners') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.affiliate_commissions c set status = 'pending', payout_id = null where c.payout_id = p_payout_id;
  delete from public.affiliate_payouts p where p.id = p_payout_id;
  if not found then
    raise exception 'payout_not_found' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.undo_affiliate_payout(uuid) from public, anon;
grant execute on function public.undo_affiliate_payout(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Brindes
-- ---------------------------------------------------------------------------

create table public.affiliate_gifts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 120),
  description text check (description is null or char_length(description) <= 1000),
  -- Para um afiliado só; nulo = todos os aprovados.
  affiliate_id uuid references public.affiliates (id) on delete cascade,
  expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index affiliate_gifts_affiliate_idx on public.affiliate_gifts (affiliate_id) where affiliate_id is not null;

create trigger affiliate_gifts_touch before update on public.affiliate_gifts
  for each row execute function public.touch_updated_at();

alter table public.affiliate_gifts enable row level security;

create policy "partners staff read gifts" on public.affiliate_gifts
  for select to authenticated using ((select public.has_permission('partners')));
create policy "affiliate reads own gifts" on public.affiliate_gifts
  for select to authenticated
  using (
    active
    and (select public.current_approved_affiliate_id()) is not null
    and (affiliate_id is null or affiliate_id = (select public.current_approved_affiliate_id()))
  );
create policy "partners staff insert gifts" on public.affiliate_gifts
  for insert to authenticated with check ((select public.has_permission('partners')));
create policy "partners staff update gifts" on public.affiliate_gifts
  for update to authenticated
  using ((select public.has_permission('partners'))) with check ((select public.has_permission('partners')));
create policy "partners staff delete gifts" on public.affiliate_gifts
  for delete to authenticated using ((select public.has_permission('partners')));

revoke all on public.affiliate_gifts from anon, authenticated;
grant select on public.affiliate_gifts to authenticated;
grant insert (title, description, affiliate_id, expires_at, active),
  update (title, description, affiliate_id, expires_at, active),
  delete on public.affiliate_gifts to authenticated;

create table public.affiliate_gift_claims (
  gift_id uuid not null references public.affiliate_gifts (id) on delete cascade,
  affiliate_id uuid not null references public.affiliates (id) on delete cascade,
  claimed_at timestamptz not null default now(),
  delivered_at timestamptz,
  primary key (gift_id, affiliate_id)
);

create index affiliate_gift_claims_affiliate_idx on public.affiliate_gift_claims (affiliate_id);

alter table public.affiliate_gift_claims enable row level security;

create policy "partners staff read gift claims" on public.affiliate_gift_claims
  for select to authenticated using ((select public.has_permission('partners')));
create policy "affiliate reads own gift claims" on public.affiliate_gift_claims
  for select to authenticated using (affiliate_id = (select public.current_affiliate_id()));

revoke all on public.affiliate_gift_claims from anon, authenticated;
grant select on public.affiliate_gift_claims to authenticated;

/** O afiliado toca em "Receber". O Jota recebe o aviso no sininho para entregar. */
create or replace function public.claim_affiliate_gift(p_gift_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.affiliates;
  gift public.affiliate_gifts;
begin
  select * into me from public.affiliates a where a.id = public.current_approved_affiliate_id();
  if me.id is null then
    raise exception 'not_affiliate' using errcode = '42501';
  end if;
  select * into gift from public.affiliate_gifts g
    where g.id = p_gift_id and g.active and (g.affiliate_id is null or g.affiliate_id = me.id);
  if gift.id is null then
    raise exception 'gift_not_found' using errcode = 'P0001';
  end if;
  if gift.expires_at is not null and gift.expires_at <= now() then
    raise exception 'gift_expired' using errcode = 'P0001';
  end if;

  insert into public.affiliate_gift_claims (gift_id, affiliate_id) values (gift.id, me.id)
  on conflict do nothing;
  if found then
    insert into public.notifications (kind, title, body, link)
    values ('news', 'Brinde para entregar', me.name || ' pediu o brinde "' || gift.title || '".', '/admin/parceiros?aba=brindes');
  end if;
end;
$$;

revoke all on function public.claim_affiliate_gift(uuid) from public, anon;
grant execute on function public.claim_affiliate_gift(uuid) to authenticated;

/** O Jota marca (ou desmarca) o brinde como entregue. */
create or replace function public.set_affiliate_gift_delivered(p_gift_id uuid, p_affiliate_id uuid, p_delivered boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('partners') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.affiliate_gift_claims
    set delivered_at = case when p_delivered then now() end
    where gift_id = p_gift_id and affiliate_id = p_affiliate_id;
  if not found then
    raise exception 'claim_not_found' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.set_affiliate_gift_delivered(uuid, uuid, boolean) from public, anon;
grant execute on function public.set_affiliate_gift_delivered(uuid, uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Números da loja no painel do afiliado
-- ---------------------------------------------------------------------------

/**
 * Afiliados aprovados e as contas vendidas nos últimos `p_days` dias (para o "mais vendidos" por tipo de conta).
 * Só para afiliado aprovado ou para a equipe.
 */
create or replace function public.affiliate_store_stats(p_days integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when public.current_approved_affiliate_id() is null and not public.has_permission('partners') then null else
    jsonb_build_object(
      'affiliates', (select count(*) from public.affiliates a where a.status = 'approved'),
      'sold_account_ids', coalesce((
        select jsonb_agg(distinct o.account_id)
        from public.orders o
        where o.account_id is not null
          and o.status in ('paid', 'delivered')
          and o.created_at > now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 365))
      ), '[]'::jsonb)
    )
  end;
$$;

revoke all on function public.affiliate_store_stats(integer) from public, anon;
grant execute on function public.affiliate_store_stats(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Indicação pelo WhatsApp
-- ---------------------------------------------------------------------------

/** Contatos que chegaram por indicação de cada afiliado (sem o número): o painel mostra "contatos recebidos". */
create table public.affiliate_whatsapp_leads (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates (id) on delete cascade,
  contact_id uuid references public.whatsapp_contacts (id) on delete set null,
  created_at timestamptz not null default now()
);

create index affiliate_whatsapp_leads_affiliate_idx on public.affiliate_whatsapp_leads (affiliate_id, created_at desc);

alter table public.affiliate_whatsapp_leads enable row level security;

create policy "partners staff read whatsapp leads" on public.affiliate_whatsapp_leads
  for select to authenticated using ((select public.has_permission('partners')));
create policy "affiliate reads own whatsapp leads" on public.affiliate_whatsapp_leads
  for select to authenticated using (affiliate_id = (select public.current_affiliate_id()));

revoke all on public.affiliate_whatsapp_leads from anon, authenticated;
grant select (id, affiliate_id, created_at) on public.affiliate_whatsapp_leads to authenticated;

/**
 * Mensagem do cliente com "código: <código>" (a que o link /indicacao/<código> já escreve): marca o contato com o
 * afiliado aprovado. Indicação mais nova vence; o mesmo afiliado não conta duas vezes no mesmo prazo.
 */
create or replace function public.whatsapp_mark_affiliate_referral()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_code text;
  owner uuid;
  contact public.whatsapp_contacts;
  days integer;
begin
  if new.direction <> 'in' then
    return null;
  end if;
  found_code := lower((regexp_match(new.body, 'c[oó]digo[:\s]+([A-Za-z0-9]{4,20})', 'i'))[1]);
  if found_code is null then
    return null;
  end if;
  select a.id into owner from public.affiliates a where a.code = found_code and a.status = 'approved';
  if owner is null then
    return null;
  end if;
  select link_days into days from public.affiliate_program;
  select * into contact from public.whatsapp_contacts c where c.id = new.contact_id;
  if contact.affiliate_id = owner and contact.affiliate_referred_at > now() - make_interval(days => days) then
    return null;
  end if;
  update public.whatsapp_contacts set affiliate_id = owner, affiliate_referred_at = now() where id = new.contact_id;
  insert into public.affiliate_whatsapp_leads (affiliate_id, contact_id) values (owner, new.contact_id);
  return null;
end;
$$;

revoke all on function public.whatsapp_mark_affiliate_referral() from public, anon, authenticated;

create trigger whatsapp_chat_affiliate_referral after insert on public.whatsapp_chat
  for each row execute function public.whatsapp_mark_affiliate_referral();
