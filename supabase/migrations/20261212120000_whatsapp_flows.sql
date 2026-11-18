-- Fluxos do WhatsApp: o passo a passo que o Jota desenha em Automação > Fluxos (blocos ligados por setas).
-- A função whatsapp-webhook segue o fluxo antes da IA; o grafo é lido de forma defensiva em _shared/whatsapp-flow.ts.

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

-- Onde cada conversa parou: o fluxo e o bloco de pergunta esperando a resposta. Só a função mexe (sem grant ao painel).
alter table public.whatsapp_contacts
  add column flow_id uuid references public.whatsapp_flows (id) on delete set null,
  add column flow_node text check (flow_node is null or char_length(flow_node) <= 100);

-- Quando o Jota assume ou devolve a conversa, o fluxo em andamento acaba: quem atende muda de verdade.
create function public.whatsapp_contacts_reset_flow() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.handler is distinct from old.handler then
    new.flow_id := null;
    new.flow_node := null;
  end if;
  return new;
end;
$$;

create trigger whatsapp_contacts_reset_flow before update of handler on public.whatsapp_contacts
  for each row execute function public.whatsapp_contacts_reset_flow();
