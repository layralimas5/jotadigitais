-- Chamado "Número de contas vendidas": contador na home que parte do total do Jota (3043 em 24/11)
-- e cresce sozinho a cada conta paga depois disso.

alter table public.store_settings
  add column sold_base integer not null default 0 check (sold_base between 0 and 10000000),
  add column sold_base_at timestamptz not null default now();

update public.store_settings set sold_base = 3043, sold_base_at = now();

-- Pedido pago ou entregue com conta, criado depois do total informado. Carrinho: cada conta é um pedido.
create or replace function public.sold_accounts_total()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s.sold_base + (
        select count(*)::integer
        from public.orders o
        where o.status in ('paid', 'delivered')
          and o.account_id is not null
          and o.created_at >= s.sold_base_at
      )
     from public.store_settings s
     limit 1),
    0
  );
$$;

revoke all on function public.sold_accounts_total() from public;
grant execute on function public.sold_accounts_total() to anon, authenticated;

-- O Jota corrige o total pelo painel (Site > Contato): as vendas seguintes somam em cima do número novo.
create or replace function public.set_sold_accounts_total(p_total integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.has_permission('site')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_total is null or p_total not between 0 and 10000000 then
    raise exception 'invalid_total' using errcode = 'P0001';
  end if;
  update public.store_settings set sold_base = p_total, sold_base_at = now();
  return public.sold_accounts_total();
end;
$$;

revoke all on function public.set_sold_accounts_total(integer) from public, anon;
grant execute on function public.set_sold_accounts_total(integer) to authenticated;
