-- Fluxos do WhatsApp: o passo a passo que o Jota desenha em WhatsApp > Fluxos (blocos ligados por setas).
-- Os fluxos ligados viram o roteiro que a IA segue (_shared/whatsapp-flow.ts, flowPlaybook); o grafo é lido de forma
-- defensiva, sem confiar no que está gravado. Onde a conversa está no roteiro, a IA tira do próprio histórico.

create table public.whatsapp_flows (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  enabled boolean not null default false,
  graph jsonb not null default '{"nodes": [], "edges": []}'::jsonb
    check (jsonb_typeof(graph) = 'object' and jsonb_typeof(graph -> 'nodes') = 'array' and jsonb_typeof(graph -> 'edges') = 'array')
    check (pg_column_size(graph) <= 200000),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index whatsapp_flows_position_idx on public.whatsapp_flows (position, created_at);

create trigger whatsapp_flows_touch before update on public.whatsapp_flows
  for each row execute function public.touch_updated_at();

alter table public.whatsapp_flows enable row level security;

create policy "whatsapp flows staff all" on public.whatsapp_flows
  for all to authenticated
  using ((select public.has_permission('automation')))
  with check ((select public.has_permission('automation')));

revoke all on public.whatsapp_flows from anon, authenticated;
grant select, insert, update, delete on public.whatsapp_flows to authenticated;
