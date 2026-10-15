-- Financeiro: despesas lançadas pelo Jota. As receitas vêm dos pedidos pagos, sem tabela própria.
-- Dado interno: só administradores leem e escrevem.

create type public.expense_category as enum ('account_purchase', 'ads', 'tools', 'fees', 'other');

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null check (char_length(description) between 2 and 120),
  category public.expense_category not null default 'other',
  amount_cents integer not null check (amount_cents between 1 and 100000000),
  spent_on date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index expenses_spent_on_idx on public.expenses (spent_on desc);

create trigger expenses_touch before update on public.expenses
  for each row execute function public.touch_updated_at();

alter table public.expenses enable row level security;

create policy "admins read expenses" on public.expenses
  for select to authenticated using (public.is_admin());

create policy "admins insert expenses" on public.expenses
  for insert to authenticated with check (public.is_admin());

create policy "admins update expenses" on public.expenses
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "admins delete expenses" on public.expenses
  for delete to authenticated using (public.is_admin());

revoke all on public.expenses from anon;
