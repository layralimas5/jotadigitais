-- Entrega da conta pelo WhatsApp:
-- 1. Mensagens de entrega salvas pelo Jota para reaproveitar (a padrão continua em message_templates.order_delivered).
-- 2. Login do perfil (usuário e senha da rede), separado do e-mail da conta. A senha segue o esquema da senha do
--    e-mail (20261028120000_email_vault): entra pela coluna `password`, o gatilho guarda só a versão cifrada e quem
--    pode ver lê pela coluna calculada profile_password_plain.

-- ---------------------------------------------------------------------------
-- Mensagens salvas
-- ---------------------------------------------------------------------------

create table public.delivery_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  body text not null check (char_length(body) between 1 and 1000),
  created_by uuid default auth.uid() references public.admin_users (user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger delivery_messages_touch before update on public.delivery_messages
  for each row execute function public.touch_updated_at();

alter table public.delivery_messages enable row level security;

create policy "delivery messages staff read" on public.delivery_messages
  for select to authenticated using ((select public.has_permission('orders')));
create policy "delivery messages staff insert" on public.delivery_messages
  for insert to authenticated with check ((select public.has_permission('orders')));
create policy "delivery messages staff update" on public.delivery_messages
  for update to authenticated using ((select public.has_permission('orders'))) with check ((select public.has_permission('orders')));
create policy "delivery messages staff delete" on public.delivery_messages
  for delete to authenticated using ((select public.has_permission('orders')));

revoke all on public.delivery_messages from anon;
grant select, insert, update, delete on public.delivery_messages to authenticated;

-- ---------------------------------------------------------------------------
-- Login do perfil
-- ---------------------------------------------------------------------------

create table public.account_profile_logins (
  account_id uuid primary key references public.accounts (id) on delete cascade,
  username text check (username is null or char_length(username) between 1 and 100),
  password text check (password is null or char_length(password) between 1 and 200),
  password_encrypted bytea,
  updated_at timestamptz not null default now()
);

create trigger account_profile_logins_touch before update on public.account_profile_logins
  for each row execute function public.touch_updated_at();

create or replace function public.encrypt_profile_password()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.password_encrypted := case when new.password is null then null else public.encrypt_pii(new.password) end;
  new.password := null;
  return new;
end;
$$;

revoke all on function public.encrypt_profile_password() from public, anon, authenticated;

create trigger account_profile_logins_encrypt_password before insert or update of password on public.account_profile_logins
  for each row execute function public.encrypt_profile_password();

-- Mesma regra da senha do e-mail: o Jota e o ajudante com E-mails leem; a desenvolvedora não.
create or replace function public.profile_password_plain(l public.account_profile_logins)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.current_admin_role() = 'admin' or (public.current_admin_role() = 'helper' and public.has_permission('emails'))
      then public.decrypt_pii(l.password_encrypted)
  end;
$$;

revoke all on function public.profile_password_plain(public.account_profile_logins) from public, anon;
grant execute on function public.profile_password_plain(public.account_profile_logins) to authenticated;

alter table public.account_profile_logins enable row level security;

create policy "profile logins staff read" on public.account_profile_logins
  for select to authenticated using ((select public.has_permission('emails')));
create policy "profile logins staff insert" on public.account_profile_logins
  for insert to authenticated with check ((select public.has_permission('emails')));
create policy "profile logins staff update" on public.account_profile_logins
  for update to authenticated using ((select public.has_permission('emails'))) with check ((select public.has_permission('emails')));
create policy "profile logins staff delete" on public.account_profile_logins
  for delete to authenticated using ((select public.has_permission('emails')));

revoke all on public.account_profile_logins from anon;
grant select, insert, update, delete on public.account_profile_logins to authenticated;
