-- TI da desenvolvedora: ver os acessos de cada usuário, encerrar sessões e apagar chamados do suporte.
-- Trocar e-mail, senha e desligar as duas etapas ficam na Edge Function admin-users (chave de serviço),
-- que confere o papel de quem pede com current_admin_role().

-- ---------------------------------------------------------------------------
-- WhatsApp do usuário, para mandar o acesso
-- ---------------------------------------------------------------------------

alter table public.admin_users
  add column whatsapp text check (whatsapp is null or whatsapp ~ '^\d{10,13}$');

-- ---------------------------------------------------------------------------
-- Lista de acessos (só a desenvolvedora)
-- ---------------------------------------------------------------------------

create or replace function public.list_access_users()
returns table (
  user_id uuid,
  name text,
  email text,
  role text,
  whatsapp text,
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

-- ---------------------------------------------------------------------------
-- Encerrar sessões: a pessoa sai de todos os aparelhos na hora (is_admin exige a sessão em auth.sessions)
-- ---------------------------------------------------------------------------

create or replace function public.end_user_sessions(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  ended integer;
begin
  if public.current_admin_role() is distinct from 'developer' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.admin_users where user_id = p_user_id) then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;
  delete from auth.sessions where user_id = p_user_id;
  get diagnostics ended = row_count;
  return ended;
end;
$$;

revoke all on function public.end_user_sessions(uuid) from public, anon;
grant execute on function public.end_user_sessions(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Apagar chamado (só a desenvolvedora). Respostas, anexos, histórico e etiqueta vão junto (cascade).
-- ---------------------------------------------------------------------------

create policy "developer deletes support tickets" on public.support_tickets
  for delete to authenticated using ((select public.current_admin_role()) = 'developer');

grant delete on public.support_tickets to authenticated;

-- Os arquivos do chamado apagado saem do bucket também.
create policy "developer deletes support files" on storage.objects
  for delete to authenticated using (bucket_id = 'support' and (select public.current_admin_role()) = 'developer');
