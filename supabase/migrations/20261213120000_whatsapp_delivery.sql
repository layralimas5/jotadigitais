-- Entrega automática pelo WhatsApp (fase 1, docs/whatsapp.md).
-- Pedido que vira pago entra na fila e o gatilho chama a Edge Function whatsapp-send pelo pg_net, como o push.
-- Em modo teste (padrão) nada sai para o cliente: a função grava no registro o texto exato que seria enviado,
-- com as senhas mascaradas, para conferir o fluxo antes da conta da Meta existir.

-- ---------------------------------------------------------------------------
-- 1. Configuração (uma linha só)
-- ---------------------------------------------------------------------------

create table public.whatsapp_settings (
  id boolean primary key default true check (id),
  -- Liga e desliga a entrega automática pelo painel.
  auto_delivery boolean not null default true,
  -- 'test' só registra; 'live' envia pela API da Meta. Troca só pelo SQL, quando a conta oficial estiver pronta.
  mode text not null default 'test' check (mode in ('test', 'live')),
  updated_at timestamptz not null default now()
);

insert into public.whatsapp_settings (id) values (true);

create trigger whatsapp_settings_touch before update on public.whatsapp_settings
  for each row execute function public.touch_updated_at();

alter table public.whatsapp_settings enable row level security;

create policy "whatsapp settings staff read" on public.whatsapp_settings
  for select to authenticated using ((select public.has_permission('automation')) or (select public.has_permission('orders')));

-- O painel só mexe no liga e desliga; o modo fica fora do alcance dele (grant por coluna).
create policy "whatsapp settings staff update" on public.whatsapp_settings
  for update to authenticated
  using ((select public.has_permission('automation')))
  with check ((select public.has_permission('automation')));

revoke all on public.whatsapp_settings from anon, authenticated;
grant select on public.whatsapp_settings to authenticated;
grant update (auto_delivery) on public.whatsapp_settings to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Registro de mensagens (fila e histórico)
-- ---------------------------------------------------------------------------

create table public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders (id) on delete cascade,
  -- payment_confirmed: modelo aprovado com o botão "Receber meu acesso"; delivery: o acesso de uma conta.
  kind text not null check (kind in ('payment_confirmed', 'delivery')),
  to_phone text not null check (to_phone ~ '^\d{10,15}$'),
  -- Texto como o cliente vê, com as senhas trocadas por ••••••. Nulo enquanto está na fila.
  body text check (body is null or char_length(body) <= 4096),
  status text not null default 'queued' check (status in ('queued', 'sending', 'test', 'sent', 'failed')),
  error text check (error is null or char_length(error) <= 1000),
  wa_message_id text unique,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index whatsapp_messages_created_idx on public.whatsapp_messages (created_at desc);
create index whatsapp_messages_order_idx on public.whatsapp_messages (order_id);

alter table public.whatsapp_messages enable row level security;

create policy "whatsapp messages staff read" on public.whatsapp_messages
  for select to authenticated using ((select public.has_permission('automation')) or (select public.has_permission('orders')));

-- Escrita só pela função (chave de serviço).
revoke all on public.whatsapp_messages from anon, authenticated;
grant select on public.whatsapp_messages to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Dados da entrega, só para a função
-- ---------------------------------------------------------------------------

/**
 * O pedido e os outros do mesmo carrinho já pagos, com o login aberto de cada conta: e-mail ligado à conta (o mais
 * recente) e login do perfil. Só a chave de serviço chama; nenhum usuário do painel ou visitante executa.
 */
create or replace function public.whatsapp_delivery_items(p_order_id uuid)
returns table (
  order_id uuid,
  code text,
  cart_code text,
  customer_name text,
  customer_whatsapp text,
  account_handle text,
  account_platform public.platform,
  total_cents integer,
  email text,
  email_password text,
  profile_username text,
  profile_password text
)
language sql
stable
security definer
set search_path = ''
as $$
  with target as (select o.id, o.cart_code from public.orders o where o.id = p_order_id)
  select
    o.id,
    o.code,
    o.cart_code,
    o.customer_name,
    o.customer_whatsapp,
    o.account_handle,
    o.account_platform,
    o.total_cents,
    e.email,
    public.decrypt_pii(e.password_encrypted),
    p.username,
    public.decrypt_pii(p.password_encrypted)
  from public.orders o
  join target t on o.id = t.id or (t.cart_code is not null and o.cart_code = t.cart_code)
  left join lateral (
    select ea.email, ea.password_encrypted
    from public.email_accounts ea
    where ea.account_id = o.account_id
    order by ea.updated_at desc
    limit 1
  ) e on true
  left join public.account_profile_logins p on p.account_id = o.account_id
  where o.status in ('paid', 'delivered')
  order by o.total_cents desc, o.code;
$$;

revoke all on function public.whatsapp_delivery_items(uuid) from public, anon, authenticated;
grant execute on function public.whatsapp_delivery_items(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 4. Gatilho: pedido pago entra na fila e chama a função
-- ---------------------------------------------------------------------------

/**
 * Vale para pagamento confirmado sozinho (C6, InfinitePay) e para "Confirmar pagamento" no painel.
 * Carrinho entra uma vez só, pelo pedido principal. Sem WhatsApp no pedido ou com a entrega desligada, nada acontece.
 */
create or replace function public.queue_whatsapp_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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
    case when new.customer_whatsapp like '55%' and char_length(new.customer_whatsapp) >= 12
      then new.customer_whatsapp else '55' || new.customer_whatsapp end
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
$$;

revoke all on function public.queue_whatsapp_payment() from public, anon, authenticated;

create trigger orders_queue_whatsapp_payment after update of status on public.orders
  for each row execute function public.queue_whatsapp_payment();
