-- Lixeira da aba Clientes.
-- Cliente que veio de pedido do site não tem cadastro para apagar: os pedidos ficam (Financeiro, garantia, LGPD)
-- e a chave dele (e-mail, wa:<número> ou pedido:<código>) entra aqui para sair da lista. Se fizer pedido depois
-- de hidden_at, o painel volta a mostrar.

create table public.hidden_customers (
  customer_key text primary key check (char_length(customer_key) between 1 and 320),
  hidden_at timestamptz not null default now(),
  hidden_by uuid default auth.uid() references public.admin_users (user_id) on delete set null
);

-- A data é sempre a do banco, inclusive ao apagar de novo (upsert), para comparar com a data dos pedidos.
create or replace function public.stamp_hidden_customer()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.hidden_at := now();
  new.hidden_by := auth.uid();
  return new;
end;
$$;

create trigger hidden_customers_stamp before insert or update on public.hidden_customers
  for each row execute function public.stamp_hidden_customer();

alter table public.hidden_customers enable row level security;

create policy "hidden customers staff read" on public.hidden_customers
  for select to authenticated using ((select public.has_permission('customers')));
create policy "hidden customers staff insert" on public.hidden_customers
  for insert to authenticated with check ((select public.has_permission('customers')));
create policy "hidden customers staff update" on public.hidden_customers
  for update to authenticated using ((select public.has_permission('customers'))) with check ((select public.has_permission('customers')));
create policy "hidden customers staff delete" on public.hidden_customers
  for delete to authenticated using ((select public.has_permission('customers')));

revoke all on public.hidden_customers from anon;
grant select, insert, update, delete on public.hidden_customers to authenticated;
