-- A desenvolvedora (TI) não aparece na lista de Usuários do Jota: nem nome, nem e-mail, nem último acesso.
-- Só ela mesma continua vendo a lista completa (aba Acessos). O nome dela nos chamados do Suporte segue
-- vindo da tabela admin_users, então nada muda lá.

create or replace function public.list_admin_users()
returns table (
  user_id uuid,
  name text,
  email text,
  role text,
  permissions text[],
  whatsapp text,
  avatar_url text,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
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
    select a.user_id, a.name, u.email::text, a.role, a.permissions, a.whatsapp, a.avatar_url, a.created_at, u.last_sign_in_at
    from public.admin_users a
    join auth.users u on u.id = a.user_id
    where a.role <> 'developer' or public.current_admin_role() = 'developer'
    order by a.created_at;
end;
$$;

revoke all on function public.list_admin_users() from public, anon;
grant execute on function public.list_admin_users() to authenticated;
