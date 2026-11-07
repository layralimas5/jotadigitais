-- 1. Aviso de login só para quem precisa: cada um vê os próprios logins; o admin também vê os dos ajudantes.
--    A desenvolvedora entrar no painel não aparece mais no sininho do Jota.
-- 2. A lista de usuários traz o WhatsApp, para a ficha do usuário em Usuários mandar o acesso.

create or replace function public.audit_admin_login()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  who text;
  who_role text;
begin
  select coalesce(a.name, u.email), a.role into who, who_role
    from public.admin_users a join auth.users u on u.id = a.user_id
    where a.user_id = new.user_id;
  if who is null then
    return new;
  end if;
  insert into public.audit_events (actor_id, action, entity, entity_id, details, ip_address)
  values (
    new.user_id, 'login', 'auth.sessions', new.id::text,
    jsonb_build_object('user_agent', left(to_jsonb(new) ->> 'user_agent', 400)),
    left(to_jsonb(new) ->> 'ip', 64)
  );
  insert into public.notifications (kind, title, body, link, recipient_role) values (
    'security',
    'Novo login no painel',
    who || ' entrou em ' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI')
      || case when who_role = 'helper' then '.' else '. Se não foi você, troque a senha e ligue a verificação em duas etapas.' end,
    case when who_role = 'helper' then '/admin/usuarios' else '/admin/configuracoes' end,
    -- Ajudante não lê avisos de segurança: o login dele vai para o admin.
    case when who_role = 'developer' then 'developer' else 'admin' end
  );
  return new;
exception when others then
  raise warning 'audit_admin_login falhou: %', sqlerrm;
  return new;
end;
$$;

revoke all on function public.audit_admin_login() from public, anon, authenticated;

-- Avisos de login que já existem: cada um passa a ser só de quem entrou.
update public.notifications n
  set recipient_role = case when a.role = 'developer' then 'developer' else 'admin' end
  from public.admin_users a
  join auth.users u on u.id = a.user_id
  where n.kind = 'security'
    and n.title = 'Novo login no painel'
    and n.recipient_role is null
    and n.body like coalesce(a.name, u.email) || ' entrou em %';

drop function public.list_admin_users();

create function public.list_admin_users()
returns table (
  user_id uuid,
  name text,
  email text,
  role text,
  permissions text[],
  whatsapp text,
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
    select a.user_id, a.name, u.email::text, a.role, a.permissions, a.whatsapp, a.created_at, u.last_sign_in_at
    from public.admin_users a
    join auth.users u on u.id = a.user_id
    order by a.created_at;
end;
$$;

revoke all on function public.list_admin_users() from public, anon;
grant execute on function public.list_admin_users() to authenticated;
