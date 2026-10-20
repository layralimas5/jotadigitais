-- Aba Configurações: cada pessoa edita o próprio nome.
-- admin_users não tem política de update (o painel nunca mexe em user_id);
-- esta função troca só o nome, e só na linha de quem chama.

create or replace function public.update_my_profile(p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.admin_users
    set name = nullif(btrim(p_name), '')
    where user_id = auth.uid();
end;
$$;

revoke all on function public.update_my_profile(text) from public, anon;
grant execute on function public.update_my_profile(text) to authenticated;
