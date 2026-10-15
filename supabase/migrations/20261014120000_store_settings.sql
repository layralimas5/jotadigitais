-- Configurações da loja: contato e garantia que o Jota ajusta pelo painel.
-- Linha única (id = true). Qualquer visitante lê; só administradores atualizam. Não há insert nem delete.

create table public.store_settings (
  id boolean primary key default true check (id),
  whatsapp_number text check (whatsapp_number is null or whatsapp_number ~ '^[0-9]{12,13}$'),
  instagram_handle text not null default '@jotadigitais' check (instagram_handle ~ '^@[A-Za-z0-9._]{1,30}$'),
  guarantee_days integer not null default 7 check (guarantee_days between 1 and 90),
  updated_at timestamptz not null default now()
);

insert into public.store_settings default values;

create trigger store_settings_touch before update on public.store_settings
  for each row execute function public.touch_updated_at();

alter table public.store_settings enable row level security;

create policy "anyone reads store settings" on public.store_settings
  for select to anon, authenticated using (true);

create policy "admins update store settings" on public.store_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

revoke insert, delete, truncate on public.store_settings from anon, authenticated;
