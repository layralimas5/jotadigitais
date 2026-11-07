-- Ajudantes: usuários que o Jota cadastra e libera só algumas áreas do sistema.
--
-- Antes, todo usuário de admin_users passava em is_admin() e lia tudo. Agora:
--   is_staff()             sessão válida de qualquer usuário do sistema (a regra antiga de is_admin)
--   is_admin()             acesso completo: Jota (admin) e desenvolvedora; ajudante NÃO passa
--   has_permission('x')    acesso completo, ou ajudante com a área 'x' liberada
-- Cada tabela da loja passa a pedir a permissão da sua área. O que não foi liberado fica fechado por padrão.

-- ---------------------------------------------------------------------------
-- Papel e permissões
-- ---------------------------------------------------------------------------

alter table public.admin_users drop constraint admin_users_role_check;
alter table public.admin_users add constraint admin_users_role_check check (role in ('admin', 'developer', 'helper'));

alter table public.admin_users
  add column permissions text[] not null default '{}'
    check (permissions <@ array['accounts', 'emails', 'orders', 'customers', 'partners', 'crm', 'automation', 'finance', 'site']::text[]);

-- Permissão só faz sentido no ajudante: os outros papéis já têm tudo.
alter table public.admin_users
  add constraint admin_users_permissions_only_helpers check (role = 'helper' or permissions = '{}');

-- ---------------------------------------------------------------------------
-- Funções de acesso
-- ---------------------------------------------------------------------------

create or replace function public.is_staff()
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

revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_staff()
    and exists (select 1 from public.admin_users a where a.user_id = auth.uid() and a.role in ('admin', 'developer'));
$$;

create or replace function public.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin()
    or (
      public.is_staff()
      and exists (
        select 1 from public.admin_users a
        where a.user_id = auth.uid() and a.role = 'helper' and p_permission = any (a.permissions)
      )
    );
$$;

revoke all on function public.has_permission(text) from public;
grant execute on function public.has_permission(text) to anon, authenticated;

-- O papel de quem está logado, agora também para o ajudante (o painel monta o menu com ele).
create or replace function public.current_admin_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select a.role from public.admin_users a where a.user_id = auth.uid() and public.is_staff();
$$;

-- ---------------------------------------------------------------------------
-- Usuários: cada um lê a própria linha (o login confere papel e permissões); a lista inteira é do admin.
-- ---------------------------------------------------------------------------

create policy "staff reads own row" on public.admin_users
  for select to authenticated using (user_id = (select auth.uid()) and (select public.is_staff()));

create or replace function public.update_my_profile(p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.admin_users
    set name = nullif(btrim(p_name), '')
    where user_id = auth.uid();
end;
$$;

drop function public.list_admin_users();

create function public.list_admin_users()
returns table (user_id uuid, name text, email text, role text, permissions text[], created_at timestamptz, last_sign_in_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select a.user_id, a.name, u.email::text, a.role, a.permissions, a.created_at, u.last_sign_in_at
    from public.admin_users a
    join auth.users u on u.id = a.user_id
    order by a.created_at;
end;
$$;

revoke all on function public.list_admin_users() from public, anon;
grant execute on function public.list_admin_users() to authenticated;

-- Troca o papel (admin ou ajudante) e as áreas liberadas. A desenvolvedora não muda por aqui,
-- ninguém muda o próprio acesso e sempre sobra pelo menos um admin.
create or replace function public.set_admin_user_access(p_user_id uuid, p_role text, p_permissions text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_role_of_target text;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'self' using errcode = 'P0001';
  end if;
  if p_role not in ('admin', 'helper') then
    raise exception 'invalid' using errcode = 'P0001';
  end if;
  select role into current_role_of_target from public.admin_users where user_id = p_user_id for update;
  if current_role_of_target is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if current_role_of_target = 'developer' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if current_role_of_target = 'admin' and p_role = 'helper'
     and not exists (select 1 from public.admin_users where role = 'admin' and user_id <> p_user_id) then
    raise exception 'last' using errcode = 'P0001';
  end if;
  update public.admin_users
    set role = p_role,
        permissions = case when p_role = 'helper' then coalesce(p_permissions, '{}') else '{}' end
    where user_id = p_user_id;
end;
$$;

revoke all on function public.set_admin_user_access(uuid, text, text[]) from public, anon;
grant execute on function public.set_admin_user_access(uuid, text, text[]) to authenticated;

-- A TI (Acessos) também mostra o ajudante.
drop function public.list_access_users();

create function public.list_access_users()
returns table (
  user_id uuid,
  name text,
  email text,
  role text,
  whatsapp text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  mfa_enabled boolean,
  active_sessions integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.current_admin_role() is distinct from 'developer' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select
      a.user_id,
      a.name,
      u.email::text,
      a.role,
      a.whatsapp,
      a.created_at,
      u.last_sign_in_at,
      exists (select 1 from auth.mfa_factors f where f.user_id = a.user_id and f.status = 'verified'),
      (select count(*)::int from auth.sessions s where s.user_id = a.user_id and s.created_at > now() - interval '7 days')
    from public.admin_users a
    join auth.users u on u.id = a.user_id
    order by a.created_at;
end;
$$;

revoke all on function public.list_access_users() from public, anon;
grant execute on function public.list_access_users() to authenticated;

-- ---------------------------------------------------------------------------
-- Senha das contas em crescimento: o Jota e o ajudante com "E-mails" veem; a desenvolvedora continua sem ver.
-- ---------------------------------------------------------------------------

create or replace function public.password_plain(e public.email_accounts)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.current_admin_role() = 'admin' or (public.current_admin_role() = 'helper' and public.has_permission('emails'))
      then public.decrypt_pii(e.password_encrypted)
  end;
$$;

-- ---------------------------------------------------------------------------
-- Regras por área
-- ---------------------------------------------------------------------------

-- Contas (estoque da vitrine)
drop policy "admins insert accounts" on public.accounts;
drop policy "admins update accounts" on public.accounts;
drop policy "admins delete accounts" on public.accounts;
create policy "accounts staff insert" on public.accounts
  for insert to authenticated with check ((select public.has_permission('accounts')));
create policy "accounts staff update" on public.accounts
  for update to authenticated using ((select public.has_permission('accounts'))) with check ((select public.has_permission('accounts')));
create policy "accounts staff delete" on public.accounts
  for delete to authenticated using ((select public.has_permission('accounts')));

-- E-mails (cofre das contas em crescimento)
drop policy "admins read email accounts" on public.email_accounts;
drop policy "admins insert email accounts" on public.email_accounts;
drop policy "admins update email accounts" on public.email_accounts;
drop policy "admins delete email accounts" on public.email_accounts;
create policy "email accounts staff read" on public.email_accounts
  for select to authenticated using ((select public.has_permission('emails')));
create policy "email accounts staff insert" on public.email_accounts
  for insert to authenticated with check ((select public.has_permission('emails')));
create policy "email accounts staff update" on public.email_accounts
  for update to authenticated using ((select public.has_permission('emails'))) with check ((select public.has_permission('emails')));
create policy "email accounts staff delete" on public.email_accounts
  for delete to authenticated using ((select public.has_permission('emails')));

-- Pedidos (pagamentos, entrega e mensagem para o cliente)
drop policy "admins read orders" on public.orders;
drop policy "admins update orders" on public.orders;
drop policy "admins read order payments" on public.order_payments;
drop policy "admins update order payments" on public.order_payments;
create policy "orders staff read" on public.orders
  for select to authenticated using ((select public.has_permission('orders')));
create policy "orders staff update" on public.orders
  for update to authenticated using ((select public.has_permission('orders'))) with check ((select public.has_permission('orders')));
create policy "order payments staff read" on public.order_payments
  for select to authenticated using ((select public.has_permission('orders')));
create policy "order payments staff update" on public.order_payments
  for update to authenticated using ((select public.has_permission('orders'))) with check ((select public.has_permission('orders')));

-- Mensagens prontas: quem entrega lê; quem cuida da automação também edita.
drop policy "admins read message templates" on public.message_templates;
drop policy "admins insert message templates" on public.message_templates;
drop policy "admins update message templates" on public.message_templates;
create policy "message templates staff read" on public.message_templates
  for select to authenticated using ((select public.has_permission('orders')) or (select public.has_permission('automation')));
create policy "message templates staff insert" on public.message_templates
  for insert to authenticated with check ((select public.has_permission('automation')));
create policy "message templates staff update" on public.message_templates
  for update to authenticated using ((select public.has_permission('automation'))) with check ((select public.has_permission('automation')));

-- Clientes
drop policy "admins read customers" on public.customers;
drop policy "admins insert customers" on public.customers;
drop policy "admins update customers" on public.customers;
drop policy "admins delete customers" on public.customers;
create policy "customers staff read" on public.customers
  for select to authenticated using ((select public.has_permission('customers')));
create policy "customers staff insert" on public.customers
  for insert to authenticated with check ((select public.has_permission('customers')));
create policy "customers staff update" on public.customers
  for update to authenticated using ((select public.has_permission('customers'))) with check ((select public.has_permission('customers')));
create policy "customers staff delete" on public.customers
  for delete to authenticated using ((select public.has_permission('customers')));

-- Parceiros
drop policy "admins read partners" on public.partners;
drop policy "admins insert partners" on public.partners;
drop policy "admins update partners" on public.partners;
drop policy "admins delete partners" on public.partners;
create policy "partners staff read" on public.partners
  for select to authenticated using ((select public.has_permission('partners')));
create policy "partners staff insert" on public.partners
  for insert to authenticated with check ((select public.has_permission('partners')));
create policy "partners staff update" on public.partners
  for update to authenticated using ((select public.has_permission('partners'))) with check ((select public.has_permission('partners')));
create policy "partners staff delete" on public.partners
  for delete to authenticated using ((select public.has_permission('partners')));

-- CRM
drop policy "admins read leads" on public.leads;
drop policy "admins insert leads" on public.leads;
drop policy "admins update leads" on public.leads;
drop policy "admins delete leads" on public.leads;
create policy "leads staff read" on public.leads
  for select to authenticated using ((select public.has_permission('crm')));
create policy "leads staff insert" on public.leads
  for insert to authenticated with check ((select public.has_permission('crm')));
create policy "leads staff update" on public.leads
  for update to authenticated using ((select public.has_permission('crm'))) with check ((select public.has_permission('crm')));
create policy "leads staff delete" on public.leads
  for delete to authenticated using ((select public.has_permission('crm')));

drop policy "admins read preferences" on public.admin_preferences;
drop policy "admins insert preferences" on public.admin_preferences;
drop policy "admins update preferences" on public.admin_preferences;
create policy "preferences staff read" on public.admin_preferences
  for select to authenticated using ((select public.has_permission('crm')));
create policy "preferences staff insert" on public.admin_preferences
  for insert to authenticated with check ((select public.has_permission('crm')));
create policy "preferences staff update" on public.admin_preferences
  for update to authenticated using ((select public.has_permission('crm'))) with check ((select public.has_permission('crm')));

-- Financeiro
drop policy "admins read revenues" on public.revenues;
drop policy "admins insert revenues" on public.revenues;
drop policy "admins update revenues" on public.revenues;
drop policy "admins delete revenues" on public.revenues;
drop policy "admins read expenses" on public.expenses;
drop policy "admins insert expenses" on public.expenses;
drop policy "admins update expenses" on public.expenses;
drop policy "admins delete expenses" on public.expenses;
create policy "revenues staff read" on public.revenues
  for select to authenticated using ((select public.has_permission('finance')));
create policy "revenues staff insert" on public.revenues
  for insert to authenticated with check ((select public.has_permission('finance')));
create policy "revenues staff update" on public.revenues
  for update to authenticated using ((select public.has_permission('finance'))) with check ((select public.has_permission('finance')));
create policy "revenues staff delete" on public.revenues
  for delete to authenticated using ((select public.has_permission('finance')));
create policy "expenses staff read" on public.expenses
  for select to authenticated using ((select public.has_permission('finance')));
create policy "expenses staff insert" on public.expenses
  for insert to authenticated with check ((select public.has_permission('finance')));
create policy "expenses staff update" on public.expenses
  for update to authenticated using ((select public.has_permission('finance'))) with check ((select public.has_permission('finance')));
create policy "expenses staff delete" on public.expenses
  for delete to authenticated using ((select public.has_permission('finance')));

-- Site e depoimentos
drop policy "admins insert site content" on public.site_content;
drop policy "admins update site content" on public.site_content;
drop policy "admins update store settings" on public.store_settings;
create policy "site content staff insert" on public.site_content
  for insert to authenticated with check ((select public.has_permission('site')));
create policy "site content staff update" on public.site_content
  for update to authenticated using ((select public.has_permission('site'))) with check ((select public.has_permission('site')));
create policy "store settings staff update" on public.store_settings
  for update to authenticated using ((select public.has_permission('site'))) with check ((select public.has_permission('site')));

drop policy "anyone reads published testimonials" on public.testimonials;
drop policy "admins insert testimonials" on public.testimonials;
drop policy "admins update testimonials" on public.testimonials;
drop policy "admins delete testimonials" on public.testimonials;
create policy "anyone reads published testimonials" on public.testimonials
  for select to anon, authenticated using (published or (select public.has_permission('site')));
create policy "testimonials staff insert" on public.testimonials
  for insert to authenticated with check ((select public.has_permission('site')));
create policy "testimonials staff update" on public.testimonials
  for update to authenticated using ((select public.has_permission('site'))) with check ((select public.has_permission('site')));
create policy "testimonials staff delete" on public.testimonials
  for delete to authenticated using ((select public.has_permission('site')));

-- Fotos (contas e site usam o mesmo bucket)
drop policy "admins read media" on storage.objects;
drop policy "admins upload media" on storage.objects;
drop policy "admins update media" on storage.objects;
drop policy "admins delete media" on storage.objects;
create policy "media staff read" on storage.objects
  for select to authenticated
  using (bucket_id = 'media' and ((select public.has_permission('accounts')) or (select public.has_permission('site'))));
create policy "media staff upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and ((select public.has_permission('accounts')) or (select public.has_permission('site'))));
create policy "media staff update" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and ((select public.has_permission('accounts')) or (select public.has_permission('site'))));
create policy "media staff delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and ((select public.has_permission('accounts')) or (select public.has_permission('site'))));

-- Avisos do sininho: pedido novo para quem cuida dos pedidos; o resto (segurança, privacidade) só para o admin.
drop policy "admins read notifications" on public.notifications;
create policy "notifications staff read" on public.notifications
  for select to authenticated using ((select public.is_admin()) or (kind = 'order' and (select public.has_permission('orders'))));

drop policy "admins read own dismissals" on public.notification_dismissals;
drop policy "admins insert own dismissals" on public.notification_dismissals;
drop policy "admins delete own dismissals" on public.notification_dismissals;
create policy "staff read own dismissals" on public.notification_dismissals
  for select to authenticated using (user_id = (select auth.uid()) and (select public.is_staff()));
create policy "staff insert own dismissals" on public.notification_dismissals
  for insert to authenticated with check (user_id = (select auth.uid()) and (select public.is_staff()));
create policy "staff delete own dismissals" on public.notification_dismissals
  for delete to authenticated using (user_id = (select auth.uid()) and (select public.is_staff()));

-- Continuam só com o acesso completo (is_admin): lista de usuários, auditoria, consentimentos, pedidos LGPD,
-- suporte, CPF dos clientes (document_plain e customer_document_plain pedem o papel admin) e retenção de dados.
