-- Preferências de tela do painel (ex.: ordem das colunas do CRM), para valer em qualquer aparelho.
-- Só administradores leem e escrevem.

create table public.admin_preferences (
  key text primary key check (key in ('crm_stage_order')),
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create trigger admin_preferences_touch before update on public.admin_preferences
  for each row execute function public.touch_updated_at();

alter table public.admin_preferences enable row level security;

create policy "admins read preferences" on public.admin_preferences
  for select to authenticated using (public.is_admin());

create policy "admins insert preferences" on public.admin_preferences
  for insert to authenticated with check (public.is_admin());

create policy "admins update preferences" on public.admin_preferences
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.admin_preferences from anon;
