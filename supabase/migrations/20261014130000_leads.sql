-- CRM: pessoas interessadas em comprar conta, acompanhadas pelo Jota até fechar ou desistir.
-- Dado interno de venda: só administradores leem e escrevem (RLS). Visitante não enxerga nada.

create type public.lead_stage as enum ('new', 'talking', 'negotiating', 'won', 'lost');
create type public.lead_source as enum ('instagram', 'whatsapp', 'tiktok', 'referral', 'other');

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  whatsapp text check (whatsapp is null or whatsapp ~ '^[0-9]{10,13}$'),
  instagram text check (instagram is null or instagram ~ '^@[A-Za-z0-9._]{1,30}$'),
  source public.lead_source not null default 'instagram',
  interest public.platform,
  stage public.lead_stage not null default 'new',
  budget_cents integer check (budget_cents is null or budget_cents between 0 and 100000000),
  next_follow_up date,
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_stage_follow_up_idx on public.leads (stage, next_follow_up);

create trigger leads_touch before update on public.leads
  for each row execute function public.touch_updated_at();

alter table public.leads enable row level security;

create policy "admins read leads" on public.leads
  for select to authenticated using (public.is_admin());

create policy "admins insert leads" on public.leads
  for insert to authenticated with check (public.is_admin());

create policy "admins update leads" on public.leads
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "admins delete leads" on public.leads
  for delete to authenticated using (public.is_admin());

revoke all on public.leads from anon;
