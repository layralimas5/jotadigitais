-- Data de entrega do pedido: a garantia conta a partir dela (aba Finalizados).

alter table public.orders add column delivered_at timestamptz;

-- Pedidos já entregues: a última atualização foi a entrega.
update public.orders set delivered_at = updated_at where status = 'delivered';

create index orders_delivered_idx on public.orders (delivered_at desc) where status = 'delivered';

-- Mesma função da migration inicial, agora marcando a hora da entrega.
create or replace function public.sync_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed boolean;
  other_active boolean;
begin
  if new.status = old.status then
    return new;
  end if;

  allowed := case old.status
    when 'awaiting_payment' then new.status in ('paid', 'canceled')
    when 'paid' then new.status in ('delivered', 'canceled')
    else false
  end;
  if not allowed then
    raise exception 'invalid_transition: % -> %', old.status, new.status using errcode = 'P0001';
  end if;

  if new.status = 'delivered' then
    new.delivered_at := now();
  end if;

  if new.account_id is null then
    return new;
  end if;

  if new.status = 'paid' then
    update public.accounts set status = 'reserved', reserved_until = null where id = new.account_id;
  elsif new.status = 'delivered' then
    update public.accounts set status = 'sold', reserved_until = null where id = new.account_id;
  elsif new.status = 'canceled' then
    select exists (
      select 1 from public.orders o
      where o.account_id = new.account_id
        and o.id <> new.id
        and (o.status in ('paid', 'delivered') or (o.status = 'awaiting_payment' and o.expires_at > now()))
    ) into other_active;
    if not other_active then
      update public.accounts set status = 'available', reserved_until = null
        where id = new.account_id and status = 'reserved';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_order_status() from public, anon, authenticated;
