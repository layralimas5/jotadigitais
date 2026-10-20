-- Textos do site editados pela aba Site do painel.
-- Uma linha só, com o conteúdo inteiro em JSON. O formato é conferido no painel (siteContentSchema);
-- o que faltar ou vier inválido cai no texto original do código, então o site nunca fica sem texto.
-- Todo mundo lê (é o texto da vitrine); só administradores gravam.

create table public.site_content (
  id boolean primary key default true check (id),
  content jsonb not null check (jsonb_typeof(content) = 'object' and pg_column_size(content) <= 200000),
  updated_at timestamptz not null default now()
);

create trigger site_content_touch before update on public.site_content
  for each row execute function public.touch_updated_at();

alter table public.site_content enable row level security;

create policy "anyone reads site content" on public.site_content
  for select to anon, authenticated using (true);

create policy "admins insert site content" on public.site_content
  for insert to authenticated with check (public.is_admin());

create policy "admins update site content" on public.site_content
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

revoke insert, update, delete on public.site_content from anon;
