-- Papel de cada usuário: o Jota é "admin" e a Lay, que mantém o sistema, é "developer".
-- Os dois têm o mesmo acesso; o papel só aparece no perfil, no menu do topo e na aba Usuários.
-- Ninguém troca o próprio papel pelo painel (admin_users segue sem política de update).

alter table public.admin_users
  add column role text not null default 'admin' check (role in ('admin', 'developer'));

update public.admin_users a
  set role = 'developer'
  from auth.users u
  where u.id = a.user_id and lower(u.email) = 'layralimas5@gmail.com';

-- O retorno ganha a coluna role, e o Postgres não troca o tipo de retorno com "create or replace".
drop function public.list_admin_users();

create function public.list_admin_users()
returns table (user_id uuid, name text, email text, role text, created_at timestamptz, last_sign_in_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select a.user_id, a.name, u.email::text, a.role, a.created_at, u.last_sign_in_at
    from public.admin_users a
    join auth.users u on u.id = a.user_id
    order by a.created_at;
end;
$$;

revoke all on function public.list_admin_users() from public, anon;
grant execute on function public.list_admin_users() to authenticated;
