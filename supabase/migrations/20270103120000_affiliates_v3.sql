-- Programa de afiliados, entrega 3 (chamado do Jota de 26/11).
--
-- A. Pagamento sem lote: toda comissão liberada (garantia acabou) pode ser paga, sem juntar 10 vendas. O afiliado
--    pode pedir o pagamento (uma vez a cada 24h) e o Jota recebe o aviso no sininho.
-- B. Página "Seja afiliado": exemplo "a cada N vendas você recebe R$ X". O N reaproveita a coluna payout_batch_size.
--    Todos os textos novos são editáveis em Parceiros > Programa > Textos (nulo = texto padrão do site).
-- C. Regras de comissão por afiliado e por tipo de conta (ex.: Shop piloto R$ 20 para todos; Gimena R$ 40 em contas
--    a partir de 2.000 seguidores).
-- D. Convite com comissão já combinada: o Jota cria o convite, a pessoa aceita os termos e valida o CPF ela mesma e
--    já entra aprovada, mesmo com o programa fechado.
-- E. Saldo de comissão vira um código de uso único para comprar uma conta no site (ou pagar só a diferença).

-- ---------------------------------------------------------------------------
-- 1. Programa: textos novos e fim do lote
-- ---------------------------------------------------------------------------

alter table public.affiliate_program
  add column incentive_text text check (incentive_text is null or char_length(incentive_text) <= 300),
  add column earn_rule_text text check (earn_rule_text is null or char_length(earn_rule_text) <= 600),
  add column payout_info_text text check (payout_info_text is null or char_length(payout_info_text) <= 600),
  add column balance_notice_text text check (balance_notice_text is null or char_length(balance_notice_text) <= 600),
  add column invite_message text check (invite_message is null or char_length(invite_message) <= 1000);

comment on column public.affiliate_program.payout_batch_size is
  'Desde a entrega 3 não é mais lote de pagamento (toda comissão liberada pode ser paga). É o N do exemplo da página Seja afiliado: "a cada N vendas você recebe R$ X". O nome da coluna ficou para não quebrar o site em cache.';

-- O Jota disse que qualquer venda já pode ser paga.
alter table public.affiliate_program alter column min_withdrawal_cents set default 100;
update public.affiliate_program set min_withdrawal_cents = 100 where id;

grant update (incentive_text, earn_rule_text, payout_info_text, balance_notice_text, invite_message)
  on public.affiliate_program to authenticated;

-- Quando o afiliado pediu o pagamento. Pagar limpa.
alter table public.affiliates add column payout_requested_at timestamptz;
grant select (payout_requested_at) on public.affiliates to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Saldo reservado e pagamento usado em compra
-- ---------------------------------------------------------------------------

-- affiliate_balance_of: cupom de saldo de um afiliado. Diferente de coupons.affiliate_id, que diz de quem é a venda.
alter table public.coupons
  add column affiliate_balance_of uuid references public.affiliates (id) on delete set null;

create index coupons_affiliate_balance_idx on public.coupons (affiliate_balance_of) where affiliate_balance_of is not null;

-- Comissão reservada num código de saldo: não entra no Pix nem em outro código até o código ser usado ou cancelado.
alter table public.affiliate_commissions
  add column balance_coupon_id uuid references public.coupons (id) on delete set null;

create index affiliate_commissions_balance_idx on public.affiliate_commissions (balance_coupon_id) where balance_coupon_id is not null;

-- Pagamento que saiu como desconto numa compra (o código de saldo), e não por Pix. Esse não se desfaz.
alter table public.affiliate_payouts
  add column coupon_id uuid references public.coupons (id) on delete set null;

/** Liberado para receber: garantia acabou, não pago, não reservado em código de saldo. */
create or replace function public.affiliate_released_cents(p_affiliate_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(c.amount_cents), 0)::integer
  from public.affiliate_commissions c
  where c.affiliate_id = p_affiliate_id
    and c.status = 'pending'
    and c.release_at <= now()
    and c.balance_coupon_id is null;
$$;

revoke all on function public.affiliate_released_cents(uuid) from public, anon, authenticated;

/** "R$ 1.234,56" para os avisos do sininho. */
create or replace function public.format_brl(p_cents integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'R$ ' || translate(to_char(coalesce(p_cents, 0) / 100.0, 'FM999,999,990.00'), ',.', '.,');
$$;

revoke all on function public.format_brl(integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Pedido de pagamento e "Paguei"
-- ---------------------------------------------------------------------------

/** O afiliado pede o pagamento do que já foi liberado. Uma vez a cada 24 horas. Devolve quando pediu. */
create or replace function public.request_affiliate_payout()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.affiliates;
  released integer;
begin
  select * into me from public.affiliates a where a.id = public.current_approved_affiliate_id() for update;
  if me.id is null then
    raise exception 'not_affiliate' using errcode = '42501';
  end if;
  released := public.affiliate_released_cents(me.id);
  if released <= 0 then
    raise exception 'nothing_to_pay' using errcode = 'P0001';
  end if;
  if me.payout_requested_at is not null and me.payout_requested_at > now() - interval '24 hours' then
    raise exception 'payout_already_requested' using errcode = 'P0001';
  end if;

  update public.affiliates set payout_requested_at = now() where id = me.id;
  insert into public.notifications (kind, title, body, link)
  values (
    'news',
    'Afiliado pediu pagamento',
    me.name || ' pediu o pagamento de ' || public.format_brl(released) || ' liberados.',
    '/admin/parceiros?aba=pagamentos'
  );
  return now();
end;
$$;

revoke all on function public.request_affiliate_payout() from public, anon;
grant execute on function public.request_affiliate_payout() to authenticated;

/**
 * "Paguei": as comissões escolhidas (do mesmo afiliado, esperando pagamento e fora de código de saldo) viram um
 * pagamento. Limpa o pedido de pagamento do afiliado. Devolve o id do pagamento.
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
    where c.id = any (p_commission_ids)
      and c.affiliate_id = p_affiliate_id
      and c.status = 'pending'
      and c.balance_coupon_id is null;
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
  update public.affiliates set payout_requested_at = null where id = p_affiliate_id;
  return payout;
end;
$$;

/** Desfaz um pagamento por Pix marcado por engano. O saldo usado numa compra não se desfaz por aqui. */
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
  if exists (select 1 from public.affiliate_payouts p where p.id = p_payout_id and p.coupon_id is not null) then
    raise exception 'payout_is_purchase' using errcode = 'P0001';
  end if;
  update public.affiliate_commissions c set status = 'pending', payout_id = null where c.payout_id = p_payout_id;
  delete from public.affiliate_payouts p where p.id = p_payout_id;
  if not found then
    raise exception 'payout_not_found' using errcode = 'P0001';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Tipo de conta no banco (igual a stockCategoryOf em src/domain/stock.ts)
-- ---------------------------------------------------------------------------

/**
 * shop_full, shop_pilot, tiktok_monetized, tiktok, instagram, youtube ou facebook. Shop do TikTok: o que o Jota
 * marcou na ficha (stats.shop); conta antiga sem marcação segue a regra dos 2.000 seguidores.
 */
create or replace function public.account_stock_category(p_account public.accounts)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_account.id is null then null
    when p_account.platform::text <> 'tiktok' then p_account.platform::text
    else case coalesce(
        case when p_account.stats ->> 'shop' in ('pilot', 'full', 'none') then p_account.stats ->> 'shop' end,
        case when p_account.followers >= 2000 then 'full' else 'pilot' end
      )
      when 'full' then 'shop_full'
      when 'pilot' then 'shop_pilot'
      else case when p_account.stats -> 'monetized' = 'true'::jsonb then 'tiktok_monetized' else 'tiktok' end
    end
  end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Convites
-- ---------------------------------------------------------------------------

create table public.affiliate_invites (
  id uuid primary key default gen_random_uuid(),
  -- Vai no link /seja-afiliado?convite=<token>. 18 bytes aleatórios em base64 de URL (24 caracteres).
  token text not null unique
    default translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_')
    check (token ~ '^[A-Za-z0-9_-]{20,64}$'),
  name text not null check (char_length(name) between 2 and 80),
  whatsapp text check (whatsapp is null or whatsapp ~ '^[0-9]{10,13}$'),
  email text check (email is null or char_length(email) between 3 and 254),
  -- Comissão própria combinada. Nula = a padrão do programa.
  commission_kind text check (commission_kind in ('percent', 'fixed')),
  commission_value integer,
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'pending' check (status in ('pending', 'claimed', 'revoked')),
  claimed_affiliate_id uuid references public.affiliates (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint affiliate_invites_commission check (
    (commission_kind is null and commission_value is null)
    or (commission_kind = 'percent' and commission_value between 1 and 90)
    or (commission_kind = 'fixed' and commission_value between 100 and 10000000)
  )
);

create index affiliate_invites_status_idx on public.affiliate_invites (status);

alter table public.affiliate_invites enable row level security;

create policy "partners staff read invites" on public.affiliate_invites
  for select to authenticated using ((select public.has_permission('partners')));
create policy "partners staff insert invites" on public.affiliate_invites
  for insert to authenticated with check ((select public.has_permission('partners')) and status = 'pending');
-- Convite aceito não muda mais (é a história de como o afiliado entrou).
create policy "partners staff update invites" on public.affiliate_invites
  for update to authenticated
  using ((select public.has_permission('partners')) and status <> 'claimed')
  with check ((select public.has_permission('partners')) and status in ('pending', 'revoked'));
create policy "partners staff delete invites" on public.affiliate_invites
  for delete to authenticated using ((select public.has_permission('partners')));

revoke all on public.affiliate_invites from anon, authenticated;
grant select on public.affiliate_invites to authenticated;
grant insert (name, whatsapp, email, commission_kind, commission_value, note) on public.affiliate_invites to authenticated;
grant update (name, whatsapp, email, commission_kind, commission_value, note, status) on public.affiliate_invites to authenticated;
grant delete on public.affiliate_invites to authenticated;

/**
 * Página "Seja afiliado" aberta pelo link do convite: devolve só nome, WhatsApp e e-mail para preencher o formulário.
 * Convite inexistente, aceito ou cancelado = nulo. Limitada por visitante para ninguém testar códigos em massa.
 */
create or replace function public.affiliate_invite_preview(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.affiliate_invites;
begin
  if coalesce(p_token, '') !~ '^[A-Za-z0-9_-]{20,64}$' then
    return null;
  end if;
  if not public.rate_limit_allows(public.rate_limit_key('affiliate-invite', p_token), 'os convites de afiliado', 30, interval '1 hour') then
    return jsonb_build_object('error', 'too_many_attempts');
  end if;
  select * into invite from public.affiliate_invites i where i.token = p_token and i.status = 'pending';
  if invite.id is null then
    return null;
  end if;
  return jsonb_build_object('name', invite.name, 'whatsapp', invite.whatsapp, 'email', invite.email);
end;
$$;

revoke all on function public.affiliate_invite_preview(text) from public;
grant execute on function public.affiliate_invite_preview(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Regras de comissão
-- ---------------------------------------------------------------------------

create table public.affiliate_commission_rules (
  id uuid primary key default gen_random_uuid(),
  -- Nulo (e sem convite) = vale para todos os afiliados.
  affiliate_id uuid references public.affiliates (id) on delete cascade,
  -- Regra combinada num convite: quando a pessoa aceita, passa para o afiliado novo.
  invite_id uuid references public.affiliate_invites (id) on delete cascade,
  -- Nulo = qualquer tipo de conta (ver account_stock_category).
  category text check (category in ('shop_full', 'shop_pilot', 'tiktok_monetized', 'tiktok', 'instagram', 'youtube', 'facebook')),
  -- Só contas com pelo menos essa quantidade de seguidores. Nulo = qualquer.
  min_followers integer check (min_followers is null or min_followers between 1 and 1000000000),
  kind text not null check (kind in ('percent', 'fixed')),
  value integer not null,
  created_at timestamptz not null default now(),
  constraint affiliate_commission_rules_value check (
    (kind = 'percent' and value between 1 and 90) or (kind = 'fixed' and value between 100 and 10000000)
  ),
  constraint affiliate_commission_rules_owner check (affiliate_id is null or invite_id is null)
);

create index affiliate_commission_rules_affiliate_idx on public.affiliate_commission_rules (affiliate_id) where affiliate_id is not null;
create index affiliate_commission_rules_invite_idx on public.affiliate_commission_rules (invite_id) where invite_id is not null;

alter table public.affiliate_commission_rules enable row level security;

-- O afiliado não lê a tabela: o painel dele recebe os valores prontos (affiliate_account_commissions) e as regras
-- que valem para ele (my_affiliate_commission_rules).
create policy "partners staff read commission rules" on public.affiliate_commission_rules
  for select to authenticated using ((select public.has_permission('partners')));
create policy "partners staff insert commission rules" on public.affiliate_commission_rules
  for insert to authenticated with check ((select public.has_permission('partners')));
create policy "partners staff update commission rules" on public.affiliate_commission_rules
  for update to authenticated
  using ((select public.has_permission('partners'))) with check ((select public.has_permission('partners')));
create policy "partners staff delete commission rules" on public.affiliate_commission_rules
  for delete to authenticated using ((select public.has_permission('partners')));

revoke all on public.affiliate_commission_rules from anon, authenticated;
grant select on public.affiliate_commission_rules to authenticated;
grant insert (affiliate_id, invite_id, category, min_followers, kind, value) on public.affiliate_commission_rules to authenticated;
grant update (category, min_followers, kind, value) on public.affiliate_commission_rules to authenticated;
grant delete on public.affiliate_commission_rules to authenticated;

-- Pedido do Jota: Shop piloto paga R$ 20 por venda para todo afiliado.
insert into public.affiliate_commission_rules (category, kind, value) values ('shop_pilot', 'fixed', 2000);

/**
 * Regra que vale para o afiliado nesta conta. Ordem: a do próprio afiliado vence a de todos; depois a que fala de
 * um tipo de conta; depois a de mais seguidores; depois a mais nova. Igual a bestCommissionRule no site.
 */
create or replace function public.affiliate_rule_for(p_affiliate_id uuid, p_account public.accounts)
returns public.affiliate_commission_rules
language sql
stable
security definer
set search_path = ''
as $$
  select r.*
  from public.affiliate_commission_rules r
  where r.invite_id is null
    and (r.affiliate_id is null or r.affiliate_id = p_affiliate_id)
    and (r.category is null or r.category = public.account_stock_category(p_account))
    and (r.min_followers is null or p_account.followers >= r.min_followers)
  order by (r.affiliate_id is not null) desc, (r.category is not null) desc, r.min_followers desc nulls last, r.created_at desc, r.id
  limit 1;
$$;

revoke all on function public.affiliate_rule_for(uuid, public.accounts) from public, anon, authenticated;

/**
 * Comissão de uma venda para um afiliado. Com regra que casa: o valor da regra, a não ser que a comissão própria da
 * conta dê mais. Sem regra: a comissão própria do afiliado no lugar da padrão; conta com comissão própria vale a da
 * conta, a não ser que a do afiliado dê mais. O afiliado nunca sai perdendo. Igual a affiliateAmountFor no site.
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
  rule public.affiliate_commission_rules;
  own_amount integer;
  account_amount integer;
begin
  select * into program from public.affiliate_program;
  select * into owner from public.affiliates a where a.id = p_affiliate_id;
  select * into account from public.accounts a where a.id = p_account_id;
  if account.affiliate_commission_kind is not null then
    account_amount := public.affiliate_commission_cents(account.affiliate_commission_kind, account.affiliate_commission_value, p_base);
  end if;
  if account.id is not null then
    rule := public.affiliate_rule_for(p_affiliate_id, account);
  end if;
  if rule.id is not null then
    return greatest(public.affiliate_commission_cents(rule.kind, rule.value, p_base), coalesce(account_amount, 0));
  end if;
  if owner.commission_kind is not null then
    own_amount := public.affiliate_commission_cents(owner.commission_kind, owner.commission_value, p_base);
  end if;
  if own_amount is not null and account_amount is not null then
    return greatest(own_amount, account_amount);
  end if;
  return coalesce(account_amount, own_amount, public.affiliate_commission_cents(program.commission_kind, program.commission_value, p_base));
end;
$$;

/** Regras que valem para o afiliado logado (as dele e as de todos), para o painel explicar quanto ele ganha. */
create or replace function public.my_affiliate_commission_rules()
returns table (id uuid, mine boolean, category text, min_followers integer, kind text, value integer, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.affiliate_id is not null, r.category, r.min_followers, r.kind, r.value, r.created_at
  from public.affiliate_commission_rules r
  where public.current_approved_affiliate_id() is not null
    and r.invite_id is null
    and (r.affiliate_id is null or r.affiliate_id = public.current_approved_affiliate_id())
  order by (r.affiliate_id is not null) desc, (r.category is not null) desc, r.min_followers desc nulls last, r.created_at desc;
$$;

revoke all on function public.my_affiliate_commission_rules() from public, anon;
grant execute on function public.my_affiliate_commission_rules() to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Cadastro com convite
-- ---------------------------------------------------------------------------

drop function public.register_affiliate(uuid, text, text, text, text, text, text);

/**
 * Cadastro do afiliado. Só a Edge Function affiliate-signup chama (chave de serviço), depois de criar o login.
 * Com convite válido: entra mesmo com o programa fechado, já aprovado, com a comissão e as regras combinadas.
 */
create or replace function public.register_affiliate(
  p_user_id uuid,
  p_name text,
  p_email text,
  p_whatsapp text,
  p_document text,
  p_terms_sha256 text,
  p_ip text,
  p_invite_token text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  program public.affiliate_program;
  invite public.affiliate_invites;
  clean_name text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  clean_whatsapp text := nullif(regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g'), '');
  clean_token text := nullif(btrim(coalesce(p_invite_token, '')), '');
  created public.affiliates;
begin
  select * into program from public.affiliate_program;
  if clean_token is not null then
    select * into invite from public.affiliate_invites i where i.token = clean_token and i.status = 'pending' for update;
    if invite.id is null then
      raise exception 'invalid_invite' using errcode = 'P0001';
    end if;
  end if;
  if not program.enabled and invite.id is null then
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

  insert into public.affiliates (
    user_id, code, name, email, whatsapp, document, status, terms_accepted_at, terms_sha256, commission_kind, commission_value
  )
  values (
    p_user_id, public.new_affiliate_code(clean_name), clean_name, lower(btrim(p_email)), clean_whatsapp, p_document,
    case when invite.id is not null or program.auto_approve then 'approved' else 'pending' end, now(), p_terms_sha256,
    invite.commission_kind, invite.commission_value
  )
  returning * into created;

  if invite.id is not null then
    update public.affiliate_commission_rules set affiliate_id = created.id, invite_id = null where invite_id = invite.id;
    update public.affiliate_invites set status = 'claimed', claimed_affiliate_id = created.id where id = invite.id;
  end if;

  insert into public.notifications (kind, title, body, link)
  values (
    'news',
    case when invite.id is not null then 'Convite de afiliado aceito'
      when created.status = 'approved' then 'Novo afiliado'
      else 'Afiliado esperando aprovação' end,
    case when invite.id is not null then created.name || ' aceitou o convite e já está aprovado no programa de afiliados.'
      else created.name || ' se cadastrou no programa de afiliados.' end,
    '/admin/parceiros?aba=afiliados'
  );

  return jsonb_build_object('id', created.id, 'status', created.status, 'code', created.code);
end;
$$;

revoke all on function public.register_affiliate(uuid, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.register_affiliate(uuid, text, text, text, text, text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 8. Código de saldo (comprar conta com a comissão)
-- ---------------------------------------------------------------------------

/** Código de saldo do afiliado logado que ainda vale (o mais novo), com o valor. */
create or replace function public.my_affiliate_balance_coupon()
returns table (code text, value integer, in_use boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select c.code, c.value, public.coupon_uses(c) > 0
  from public.coupons c
  where c.affiliate_balance_of = public.current_approved_affiliate_id()
    and c.active
  order by c.created_at desc
  limit 1;
$$;

revoke all on function public.my_affiliate_balance_coupon() from public, anon;
grant execute on function public.my_affiliate_balance_coupon() to authenticated;

/**
 * Transforma o saldo liberado num código de uso único (desconto fixo no valor do saldo). Se já existe um valendo,
 * devolve o mesmo. As comissões usadas ficam reservadas até o código ser usado ou cancelado.
 */
create or replace function public.create_affiliate_balance_coupon()
returns table (code text, value integer, in_use boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.affiliates;
  existing public.coupons;
  total integer;
  new_code text;
  created public.coupons;
begin
  -- Trava o afiliado: dois toques seguidos não criam dois códigos.
  select * into me from public.affiliates a where a.id = public.current_approved_affiliate_id() for update;
  if me.id is null then
    raise exception 'not_affiliate' using errcode = '42501';
  end if;
  select * into existing from public.coupons c
    where c.affiliate_balance_of = me.id and c.active
    order by c.created_at desc limit 1;
  if existing.id is not null then
    return query select existing.code, existing.value, public.coupon_uses(existing) > 0;
    return;
  end if;

  total := public.affiliate_released_cents(me.id);
  if total < 100 then
    raise exception 'balance_too_low' using errcode = 'P0001';
  end if;
  if total > 10000000 then
    raise exception 'balance_too_high' using errcode = 'P0001';
  end if;

  loop
    new_code := upper('SALDO' || me.code || substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 4));
    exit when not exists (select 1 from public.coupons c where c.code = new_code);
  end loop;

  insert into public.coupons (code, kind, value, max_uses, notes, affiliate_balance_of)
  values (
    new_code, 'fixed', total, 1,
    'Saldo de comissão de ' || me.name || ' (afiliado). Criado pelo painel do afiliado, vale uma compra.',
    me.id
  )
  returning * into created;

  update public.affiliate_commissions c
    set balance_coupon_id = created.id
    where c.affiliate_id = me.id and c.status = 'pending' and c.release_at <= now() and c.balance_coupon_id is null;
  -- O saldo saiu do Pix: o pedido de pagamento em aberto deixa de valer.
  update public.affiliates set payout_requested_at = null where id = me.id;

  return query select created.code, created.value, false;
end;
$$;

revoke all on function public.create_affiliate_balance_coupon() from public, anon;
grant execute on function public.create_affiliate_balance_coupon() to authenticated;

/** O afiliado desiste do código: some do site e o saldo volta a poder ser pago por Pix. */
create or replace function public.cancel_affiliate_balance_coupon()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.current_approved_affiliate_id();
  current_coupon public.coupons;
begin
  if me is null then
    raise exception 'not_affiliate' using errcode = '42501';
  end if;
  select * into current_coupon from public.coupons c
    where c.affiliate_balance_of = me and c.active
    order by c.created_at desc limit 1
    for update;
  if current_coupon.id is null then
    raise exception 'balance_coupon_not_found' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.orders o where o.coupon_id = current_coupon.id and o.status <> 'canceled') then
    raise exception 'balance_coupon_in_use' using errcode = 'P0001';
  end if;
  update public.coupons set active = false where id = current_coupon.id;
  update public.affiliate_commissions set balance_coupon_id = null where balance_coupon_id = current_coupon.id and status = 'pending';
end;
$$;

revoke all on function public.cancel_affiliate_balance_coupon() from public, anon;
grant execute on function public.cancel_affiliate_balance_coupon() to authenticated;

/**
 * Comissão reservada que é cancelada (pedido de origem cancelado, ou o Jota cancelou à mão): o código de saldo ainda
 * sem uso é desligado e o resto do saldo volta a ficar livre. O afiliado gera outro com o valor certo.
 */
create or replace function public.release_balance_on_commission_cancel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  reserved_coupon uuid := old.balance_coupon_id;
begin
  if new.status <> 'canceled' or reserved_coupon is null then
    return new;
  end if;
  new.balance_coupon_id := null;
  if not exists (select 1 from public.orders o where o.coupon_id = reserved_coupon and o.status <> 'canceled') then
    update public.coupons set active = false where id = reserved_coupon;
    update public.affiliate_commissions
      set balance_coupon_id = null
      where balance_coupon_id = reserved_coupon and id <> new.id and status = 'pending';
  end if;
  return new;
end;
$$;

revoke all on function public.release_balance_on_commission_cancel() from public, anon, authenticated;

create trigger affiliate_commissions_release_balance before update of status on public.affiliate_commissions
  for each row
  when (old.status is distinct from new.status and new.status = 'canceled')
  execute function public.release_balance_on_commission_cancel();

/**
 * Pedido pago com código de saldo: o saldo foi usado. Grava o pagamento (sem Pix, "Usado na compra <pedido>"),
 * marca as comissões reservadas como pagas e desliga o código.
 */
create or replace function public.affiliate_balance_coupon_on_paid()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  balance_coupon public.coupons;
  picked integer;
  total integer;
  payout uuid;
begin
  if new.coupon_id is null then
    return null;
  end if;
  select * into balance_coupon from public.coupons c where c.id = new.coupon_id and c.affiliate_balance_of is not null;
  if balance_coupon.id is null or exists (select 1 from public.affiliate_payouts p where p.coupon_id = balance_coupon.id) then
    return null;
  end if;

  select count(*), coalesce(sum(c.amount_cents), 0) into picked, total
    from public.affiliate_commissions c
    where c.balance_coupon_id = balance_coupon.id and c.status = 'pending';
  if picked > 0 then
    insert into public.affiliate_payouts (affiliate_id, commissions_count, amount_cents, pix_key, note, coupon_id, created_by)
    values (balance_coupon.affiliate_balance_of, picked, total, null, 'Usado na compra ' || new.code, balance_coupon.id, null)
    returning id into payout;
    update public.affiliate_commissions c
      set status = 'paid', payout_id = payout
      where c.balance_coupon_id = balance_coupon.id and c.status = 'pending';
  end if;
  update public.coupons set active = false where id = balance_coupon.id;
  return null;
end;
$$;

revoke all on function public.affiliate_balance_coupon_on_paid() from public, anon, authenticated;

create trigger orders_affiliate_balance_coupon after update of status on public.orders
  for each row
  when (old.status is distinct from new.status and new.status in ('paid', 'delivered'))
  execute function public.affiliate_balance_coupon_on_paid();

/**
 * Confere o cupom para um preço e devolve o desconto em centavos. Erros: coupon_not_found, coupon_inactive,
 * coupon_not_started, coupon_expired, coupon_exhausted e, no código de saldo de afiliado, balance_exceeds_price
 * (o saldo inteiro tem que caber: o código é de uso único e não sobra troco). `p_lock` trava a linha para dois
 * pedidos não passarem do limite de usos ao mesmo tempo.
 */
create or replace function public.coupon_discount(
  p_code text,
  p_price_cents integer,
  p_lock boolean,
  out coupon_id uuid,
  out coupon_code text,
  out discount_cents integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_code text := upper(btrim(coalesce(p_code, '')));
  coupon public.coupons;
begin
  if p_lock then
    select * into coupon from public.coupons c where c.code = clean_code for update;
  else
    select * into coupon from public.coupons c where c.code = clean_code;
  end if;
  if coupon.id is null then
    raise exception 'coupon_not_found' using errcode = 'P0001';
  end if;
  if not coupon.active then
    raise exception 'coupon_inactive' using errcode = 'P0001';
  end if;
  if coupon.starts_at is not null and now() < coupon.starts_at then
    raise exception 'coupon_not_started' using errcode = 'P0001';
  end if;
  if coupon.ends_at is not null and now() >= coupon.ends_at then
    raise exception 'coupon_expired' using errcode = 'P0001';
  end if;
  if coupon.max_uses is not null and public.coupon_uses(coupon) >= coupon.max_uses then
    raise exception 'coupon_exhausted' using errcode = 'P0001';
  end if;
  if coupon.affiliate_balance_of is not null and p_price_cents - public.coupon_min_total_cents() < coupon.value then
    raise exception 'balance_exceeds_price' using errcode = 'P0001';
  end if;

  discount_cents := case coupon.kind
    when 'percent' then round(p_price_cents * coupon.value / 100.0)::integer
    else coupon.value
  end;
  discount_cents := greatest(0, least(discount_cents, p_price_cents - public.coupon_min_total_cents()));
  coupon_id := coupon.id;
  coupon_code := coupon.code;
end;
$$;

revoke all on function public.coupon_discount(text, integer, boolean) from public, anon, authenticated;

insert into supabase_migrations.schema_migrations (version, name) values ('20270103120000', 'affiliates_v3') on conflict do nothing;
