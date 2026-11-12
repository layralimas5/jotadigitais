-- Painel como app no celular (PWA) com notificação push, mesmo com o painel fechado.
--
-- 1. Aviso novo no sininho: "Pagamento confirmado" (kind payment) quando o pedido vira pago sozinho
--    (InfinitePay, Pix do C6). Marcar como pago à mão no painel não avisa quem acabou de marcar.
-- 2. push_subscriptions: cada aparelho que ligou o aviso (o endereço que o navegador entrega).
-- 3. push_preferences: quais tipos de aviso cada pessoa quer receber no celular.
-- 4. Toda linha nova em notifications chama a função push-send (pg_net), que manda para os aparelhos
--    de quem pode ver aquele aviso. Sem os segredos push_send_url e push_send_secret no Vault, nada sai.

-- ---------------------------------------------------------------------------
-- 1. Pagamento confirmado
-- ---------------------------------------------------------------------------

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('order', 'payment', 'news', 'privacy', 'security', 'support'));

-- O ajudante com Pedidos vê a venda nova e o pagamento confirmado.
drop policy "notifications staff read" on public.notifications;
create policy "notifications staff read" on public.notifications
  for select to authenticated
  using (
    ((select public.is_admin()) and (recipient_role is null or recipient_role = (select public.current_admin_role())))
    or (kind in ('order', 'payment') and recipient_role is null and (select public.has_permission('orders')))
  );

create or replace function public.notify_order_paid()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cart_total bigint;
  cart_items integer;
begin
  -- Pedido de carrinho: avisa uma vez só, pelo principal, com a soma das contas.
  if new.cart_code is not null and new.cart_code <> new.code then
    return null;
  end if;
  -- Quem marcou como pago no painel já sabe.
  if auth.uid() is not null and public.is_staff() then
    return null;
  end if;

  select coalesce(sum(o.total_cents), new.total_cents), greatest(count(*), 1)
    into cart_total, cart_items
    from public.orders o
    where new.cart_code is not null and o.cart_code = new.cart_code;

  insert into public.notifications (kind, title, body, link)
  values (
    'payment',
    'Pagamento confirmado ' || new.code,
    new.customer_name || ' pagou '
      || case when cart_items > 1 then cart_items || ' contas' else new.account_handle end
      || ' (R$ ' || replace(to_char(cart_total / 100.0, 'FM999999990.00'), '.', ',') || '). Falta entregar.',
    '/admin/pedidos'
  );
  return null;
end;
$$;

revoke all on function public.notify_order_paid() from public, anon, authenticated;

create trigger orders_notify_paid after update of status on public.orders
  for each row
  when (old.status = 'awaiting_payment' and new.status = 'paid')
  execute function public.notify_order_paid();

-- ---------------------------------------------------------------------------
-- 2. Aparelhos inscritos
-- ---------------------------------------------------------------------------

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.admin_users (user_id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) between 1 and 200),
  auth text not null check (char_length(auth) between 1 and 100),
  device text check (device is null or char_length(device) <= 120),
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "staff read own push subscriptions" on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()) and (select public.is_staff()));

-- Gravar e apagar só pelas funções abaixo: o mesmo aparelho pode trocar de dono (outra pessoa loga nele).
revoke all on public.push_subscriptions from anon, authenticated;
grant select on public.push_subscriptions to authenticated;

/** Liga o aviso neste aparelho para quem está logado. Se o aparelho era de outra pessoa, passa a ser desta. */
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_device text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, device)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, nullif(left(trim(coalesce(p_device, '')), 120), ''))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, device = excluded.device, created_at = now();
end;
$$;

revoke all on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;

/** Desliga o aviso neste aparelho. Só apaga o que é de quem está logado. */
create or replace function public.delete_push_subscription(p_endpoint text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
end;
$$;

revoke all on function public.delete_push_subscription(text) from public, anon;
grant execute on function public.delete_push_subscription(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Tipos de aviso que cada pessoa quer no celular (sem linha = todos)
-- ---------------------------------------------------------------------------

create table public.push_preferences (
  user_id uuid primary key default auth.uid() references public.admin_users (user_id) on delete cascade,
  kinds text[] not null
    check (kinds <@ array['order', 'payment', 'support', 'security', 'privacy', 'news']::text[]),
  updated_at timestamptz not null default now()
);

alter table public.push_preferences enable row level security;

create policy "staff read own push preferences" on public.push_preferences
  for select to authenticated using (user_id = (select auth.uid()) and (select public.is_staff()));
create policy "staff insert own push preferences" on public.push_preferences
  for insert to authenticated with check (user_id = (select auth.uid()) and (select public.is_staff()));
create policy "staff update own push preferences" on public.push_preferences
  for update to authenticated
  using (user_id = (select auth.uid()) and (select public.is_staff()))
  with check (user_id = (select auth.uid()) and (select public.is_staff()));

revoke all on public.push_preferences from anon, authenticated;
grant select, insert, update on public.push_preferences to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Disparo: cada aviso novo chama a função push-send
-- ---------------------------------------------------------------------------

-- pg_net faz a chamada HTTP fora da transação: o pedido entra mesmo se o envio falhar.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
  end if;
end;
$$;

create or replace function public.dispatch_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_url text;
  send_secret text;
begin
  if not exists (select 1 from public.push_subscriptions) then
    return null;
  end if;
  select decrypted_secret into target_url from vault.decrypted_secrets where name = 'push_send_url';
  select decrypted_secret into send_secret from vault.decrypted_secrets where name = 'push_send_secret';
  if target_url is null or send_secret is null then
    raise warning 'push: push_send_url ou push_send_secret ausente no Vault; aviso % não foi enviado', new.id;
    return null;
  end if;
  perform net.http_post(
    url := target_url,
    body := jsonb_build_object('notification_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', send_secret),
    timeout_milliseconds := 10000
  );
  return null;
end;
$$;

revoke all on function public.dispatch_push() from public, anon, authenticated;

create trigger notifications_dispatch_push after insert on public.notifications
  for each row execute function public.dispatch_push();
