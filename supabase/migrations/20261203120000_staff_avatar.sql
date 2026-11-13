-- Foto de perfil de quem usa o painel (admin, desenvolvedora e ajudante), escolhida em Configurações.
-- O arquivo vai para o bucket público `media`, na pasta avatars/<id do usuário>/; cada pessoa só mexe na própria pasta.

alter table public.admin_users
  add column avatar_url text check (avatar_url is null or (char_length(avatar_url) <= 500 and avatar_url like 'https://%'));

-- Grava (ou tira, com nulo) a própria foto. Só aceita arquivo da pasta da própria pessoa no bucket media.
create or replace function public.set_my_avatar(p_url text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_url is not null and position('/storage/v1/object/public/media/avatars/' || auth.uid()::text || '/' in p_url) = 0 then
    raise exception 'invalid avatar url' using errcode = '22023';
  end if;
  update public.admin_users
    set avatar_url = p_url
    where user_id = auth.uid();
end;
$$;

revoke all on function public.set_my_avatar(text) from public, anon;
grant execute on function public.set_my_avatar(text) to authenticated;

-- Pasta da própria foto: o ajudante sem Contas/Site também precisa enviar, listar e apagar a dele.
create policy "media own avatar read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'avatars'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and (select public.is_staff())
  );
create policy "media own avatar upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'avatars'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and (select public.is_staff())
  );
create policy "media own avatar delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'avatars'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and (select public.is_staff())
  );

-- Lista de Usuários e Acessos com a foto.
drop function public.list_admin_users();

create function public.list_admin_users()
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
    order by a.created_at;
end;
$$;

revoke all on function public.list_admin_users() from public, anon;
grant execute on function public.list_admin_users() to authenticated;

-- Aba Acessos (TI) com a foto.
drop function public.list_access_users();

create function public.list_access_users()
returns table (
  user_id uuid,
  name text,
  email text,
  role text,
  whatsapp text,
  avatar_url text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  mfa_enabled boolean,
  active_sessions integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.current_admin_role() is distinct from 'developer' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select
      a.user_id,
      a.name,
      u.email::text,
      a.role,
      a.whatsapp,
      a.avatar_url,
      a.created_at,
      u.last_sign_in_at,
      exists (select 1 from auth.mfa_factors f where f.user_id = a.user_id and f.status = 'verified'),
      (select count(*)::int from auth.sessions s where s.user_id = a.user_id and s.created_at > now() - interval '7 days')
    from public.admin_users a
    join auth.users u on u.id = a.user_id
    order by a.created_at;
end;
$$;

revoke all on function public.list_access_users() from public, anon;
grant execute on function public.list_access_users() to authenticated;
