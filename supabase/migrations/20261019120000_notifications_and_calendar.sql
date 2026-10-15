-- Sininho do painel: pedidos novos (gravados pelo banco na hora) e novidades do sistema.
-- Cada usuário apaga as próprias notificações sem sumir com elas para os outros.
-- Também libera a preferência google_calendar (conta Google ligada na aba Conexões).

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('order', 'news')),
  title text not null check (char_length(title) between 1 and 120),
  body text check (body is null or char_length(body) <= 500),
  -- Só telas do próprio painel: notificação nunca leva para fora.
  link text check (link is null or link ~ '^/admin(/|$)'),
  created_at timestamptz not null default now()
);

create index notifications_created_idx on public.notifications (created_at desc);

alter table public.notifications enable row level security;

create policy "admins read notifications" on public.notifications
  for select to authenticated using (public.is_admin());

-- Ninguém insere pelo painel: só o gatilho abaixo e as migrations.
revoke all on public.notifications from anon;
revoke insert, update, delete on public.notifications from authenticated;

create table public.notification_dismissals (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null check (char_length(key) between 1 and 200),
  dismissed_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.notification_dismissals enable row level security;

create policy "admins read own dismissals" on public.notification_dismissals
  for select to authenticated using (user_id = auth.uid() and public.is_admin());

create policy "admins insert own dismissals" on public.notification_dismissals
  for insert to authenticated with check (user_id = auth.uid() and public.is_admin());

create policy "admins delete own dismissals" on public.notification_dismissals
  for delete to authenticated using (user_id = auth.uid() and public.is_admin());

revoke all on public.notification_dismissals from anon;

-- Pedido novo do site vira notificação. Mesmo texto do modo demonstração.
create or replace function public.notify_new_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (kind, title, body, link)
  values (
    'order',
    'Novo pedido ' || new.code,
    new.customer_name || ' pediu ' || new.account_handle || ' por R$ '
      || replace(to_char(new.total_cents / 100.0, 'FM999999990.00'), '.', ',') || '. Aguardando pagamento.',
    '/admin/pedidos'
  );
  return new;
end;
$$;

revoke all on function public.notify_new_order() from public, anon, authenticated;

create trigger orders_notify_new after insert on public.orders
  for each row execute function public.notify_new_order();

insert into public.notifications (kind, title, body, link, created_at) values
  ('news', 'Novo: envie uma conta pelo WhatsApp',
   'O botão verde em cada conta monta a mensagem com os números, o preço e o link de compra.', '/admin/contas', now() - interval '2 minutes'),
  ('news', 'Novo: puxe os dados da conta pelo link',
   'Na ficha da conta, cole o link do perfil e o sistema preenche seguidores, curtidas e foto.', '/admin/contas', now() - interval '1 minute'),
  ('news', 'Novo: conecte seu Google Agenda',
   'Em Conexões, ligue sua agenda e mande os retornos do CRM para o celular.', '/admin/apis', now());

alter table public.admin_preferences drop constraint admin_preferences_key_check;

alter table public.admin_preferences add constraint admin_preferences_key_check
  check (key in ('crm_stage_order', 'google_calendar'));
