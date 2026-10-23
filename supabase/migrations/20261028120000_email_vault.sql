-- E-mails: os e-mails (e as senhas) das contas que o Jota está crescendo. Depende da migration de segurança
-- (20261027120000), que criou a chave no Vault e as funções encrypt_pii/decrypt_pii.
-- A senha entra pela coluna `password` e o gatilho guarda só a versão cifrada. Só administrador lê a senha aberta,
-- pela coluna calculada password_plain, e a lista do painel nem pede essa coluna.

create table public.email_accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) between 3 and 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  password text check (password is null or char_length(password) between 1 and 200),
  password_encrypted bytea,
  used_for text check (used_for is null or char_length(used_for) between 1 and 120),
  recovery_email text check (recovery_email is null or (char_length(recovery_email) <= 254 and recovery_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  recovery_phone text check (recovery_phone is null or recovery_phone ~ '^[0-9]{10,13}$'),
  account_id uuid references public.accounts (id) on delete set null,
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index email_accounts_email_key on public.email_accounts (lower(email));
create index email_accounts_account_idx on public.email_accounts (account_id) where account_id is not null;

create trigger email_accounts_touch before update on public.email_accounts
  for each row execute function public.touch_updated_at();

-- Mesmo esquema do CPF: o gatilho de update só dispara quando o update cita a coluna, então "set password = null"
-- apaga a senha e um update de outra coluna não mexe nela.
create or replace function public.encrypt_email_password()
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

revoke all on function public.encrypt_email_password() from public, anon, authenticated;

create trigger email_accounts_encrypt_password before insert or update of password on public.email_accounts
  for each row execute function public.encrypt_email_password();

create or replace function public.password_plain(e public.email_accounts)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when public.is_admin() then public.decrypt_pii(e.password_encrypted) end;
$$;

-- A lista mostra se há senha anotada sem trazer a senha.
create or replace function public.has_password(e public.email_accounts)
returns boolean
language sql
stable
set search_path = ''
as $$
  select e.password_encrypted is not null;
$$;

revoke all on function public.password_plain(public.email_accounts) from public, anon;
revoke all on function public.has_password(public.email_accounts) from public, anon;
grant execute on function public.password_plain(public.email_accounts) to authenticated;
grant execute on function public.has_password(public.email_accounts) to authenticated;

alter table public.email_accounts enable row level security;

create policy "admins read email accounts" on public.email_accounts
  for select to authenticated using ((select public.is_admin()));

create policy "admins insert email accounts" on public.email_accounts
  for insert to authenticated with check ((select public.is_admin()));

create policy "admins update email accounts" on public.email_accounts
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "admins delete email accounts" on public.email_accounts
  for delete to authenticated using ((select public.is_admin()));

revoke all on public.email_accounts from anon;

create trigger audit_delete after delete on public.email_accounts for each row execute function public.audit_row_change();
