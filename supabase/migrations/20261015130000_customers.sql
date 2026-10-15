-- Clientes cadastrados à mão pelo Jota. O painel junta com os pedidos pelo e-mail.
-- Dado pessoal: só administradores leem e escrevem (RLS).

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  email text check (email is null or (char_length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
  whatsapp text check (whatsapp is null or whatsapp ~ '^[0-9]{10,13}$'),
  instagram text check (instagram is null or instagram ~ '^@[A-Za-z0-9._]{1,30}$'),
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_has_contact check (email is not null or whatsapp is not null or instagram is not null)
);

create unique index customers_email_key on public.customers (lower(email)) where email is not null;

create trigger customers_touch before update on public.customers
  for each row execute function public.touch_updated_at();

alter table public.customers enable row level security;

create policy "admins read customers" on public.customers
  for select to authenticated using (public.is_admin());

create policy "admins insert customers" on public.customers
  for insert to authenticated with check (public.is_admin());

create policy "admins update customers" on public.customers
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "admins delete customers" on public.customers
  for delete to authenticated using (public.is_admin());

revoke all on public.customers from anon;
