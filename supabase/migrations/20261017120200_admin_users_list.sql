-- Usuários do sistema (aba Usuários).
-- A lista junta admin_users com o e-mail e o último acesso do Supabase Auth, que o painel não lê direto.
-- Criar e remover usuário exige a chave de serviço: isso fica na Edge Function admin-users.

alter table public.admin_users
  add column name text check (name is null or char_length(name) between 2 and 80);

create or replace function public.list_admin_users()
returns table (user_id uuid, name text, email text, created_at timestamptz, last_sign_in_at timestamptz)
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
    select a.user_id, a.name, u.email::text, a.created_at, u.last_sign_in_at
    from public.admin_users a
    join auth.users u on u.id = a.user_id
    order by a.created_at;
end;
$$;

revoke all on function public.list_admin_users() from public, anon;
grant execute on function public.list_admin_users() to authenticated;
