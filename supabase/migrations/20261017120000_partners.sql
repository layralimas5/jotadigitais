-- Parceiros: quem fornece contas para a loja e recebe uma parte de cada venda finalizada.
-- Dado interno (inclui chave Pix): só administradores leem e escrevem.

create table public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  whatsapp text check (whatsapp is null or whatsapp ~ '^[0-9]{10,13}$'),
  instagram text check (instagram is null or instagram ~ '^@[A-Za-z0-9._]{1,30}$'),
  pix_key text check (pix_key is null or char_length(pix_key) between 1 and 140),
  commission_percent numeric(5, 2) not null default 0 check (commission_percent between 0 and 100),
  notes text check (notes is null or char_length(notes) <= 2000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger partners_touch before update on public.partners
  for each row execute function public.touch_updated_at();

alter table public.partners enable row level security;

create policy "admins read partners" on public.partners
  for select to authenticated using (public.is_admin());

create policy "admins insert partners" on public.partners
  for insert to authenticated with check (public.is_admin());

create policy "admins update partners" on public.partners
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "admins delete partners" on public.partners
  for delete to authenticated using (public.is_admin());

revoke all on public.partners from anon;

-- Conta fornecida por um parceiro. Apagar o parceiro deixa a conta como da loja.
alter table public.accounts
  add column partner_id uuid references public.partners (id) on delete set null;

create index accounts_partner_idx on public.accounts (partner_id) where partner_id is not null;
