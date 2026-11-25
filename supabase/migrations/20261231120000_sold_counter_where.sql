-- Chamado "Número de contas vendidas": salvar o total pelo painel dava "Não foi possível falar com o servidor".
-- As chamadas da API passam pelo safeupdate, que barra UPDATE sem WHERE. store_settings tem uma linha só (id = true).

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
  update public.store_settings set sold_base = p_total, sold_base_at = now() where id;
  return public.sold_accounts_total();
end;
$$;

insert into supabase_migrations.schema_migrations (version, name) values ('20261231120000', 'sold_counter_where') on conflict do nothing;
