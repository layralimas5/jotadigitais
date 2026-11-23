-- Lista de espera de conta nova (chamado do Jota de 23/11, "Botão de notificar o cliente").
-- O cliente deixa nome, WhatsApp e os tipos de conta que quer; o Jota vê no painel quem espera cada tipo
-- e avisa pelo WhatsApp quando chega conta. Os tipos são os mesmos do Estoque por tipo (src/domain/stock.ts).

create table public.stock_alerts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  whatsapp text not null check (whatsapp ~ '^[0-9]{10,13}$'),
  categories text[] not null check (
    cardinality(categories) between 1 and 6
    and categories <@ array['shop_full', 'shop_pilot', 'tiktok_monetized', 'tiktok', 'instagram', 'youtube']::text[]
  ),
  created_at timestamptz not null default now(),
  notified_at timestamptz
);

-- Um pedido por número: inscrever de novo atualiza o que já existe.
create unique index stock_alerts_whatsapp_key on public.stock_alerts (whatsapp);
create index stock_alerts_pending_idx on public.stock_alerts (created_at desc) where notified_at is null;

alter table public.stock_alerts enable row level security;

-- Quem tem a área Clientes vê, marca como avisado e apaga. Ninguém de fora lê a lista.
create policy "stock alerts staff read" on public.stock_alerts
  for select to authenticated using ((select public.has_permission('customers')));
create policy "stock alerts staff update" on public.stock_alerts
  for update to authenticated using ((select public.has_permission('customers'))) with check ((select public.has_permission('customers')));
create policy "stock alerts staff delete" on public.stock_alerts
  for delete to authenticated using ((select public.has_permission('customers')));

revoke all on public.stock_alerts from anon, authenticated;
grant select, delete on public.stock_alerts to authenticated;
grant update (notified_at) on public.stock_alerts to authenticated;

/**
 * Inscrição pelo site (anon). Número já na lista: troca o nome, junta os tipos se ainda está esperando
 * (ou recomeça com os novos se já tinha sido avisado) e volta para "aguardando". Limite de 5 por hora por IP.
 */
create or replace function public.subscribe_stock_alert(p_name text, p_whatsapp text, p_categories text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_name text := btrim(coalesce(p_name, ''));
  clean_phone text := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
  clean_categories text[] := (select array_agg(distinct category order by category) from unnest(coalesce(p_categories, '{}')) as category);
begin
  if not public.rate_limit_allows(public.rate_limit_key('stock_alert', clean_phone), 'a lista de espera de contas', 5, interval '1 hour') then
    raise exception 'too_many_attempts' using errcode = 'P0001';
  end if;
  insert into public.stock_alerts as alert (name, whatsapp, categories)
  values (clean_name, clean_phone, clean_categories)
  on conflict (whatsapp) do update set
    name = excluded.name,
    categories = case
      when alert.notified_at is null then (select array_agg(distinct category order by category) from unnest(alert.categories || excluded.categories) as category)
      else excluded.categories
    end,
    created_at = case when alert.notified_at is null then alert.created_at else now() end,
    notified_at = null;
end;
$$;

revoke all on function public.subscribe_stock_alert(text, text, text[]) from public;
grant execute on function public.subscribe_stock_alert(text, text, text[]) to anon, authenticated;
