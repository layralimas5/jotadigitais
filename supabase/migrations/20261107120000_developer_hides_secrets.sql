-- A desenvolvedora vê o painel como o Jota (modo visualização), mas sem os dados mais sensíveis:
-- CPF/CNPJ de pedidos e clientes e as senhas dos e-mails das contas voltam nulos para ela.
-- Só o papel "admin" (o Jota) abre esses campos; as regras de sessão e duas etapas do is_admin continuam valendo.

create or replace function public.customer_document_plain(o public.orders)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when public.current_admin_role() = 'admin' then public.decrypt_pii(o.customer_document_encrypted) end;
$$;

create or replace function public.document_plain(c public.customers)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when public.current_admin_role() = 'admin' then public.decrypt_pii(c.document_encrypted) end;
$$;

create or replace function public.password_plain(e public.email_accounts)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when public.current_admin_role() = 'admin' then public.decrypt_pii(e.password_encrypted) end;
$$;
