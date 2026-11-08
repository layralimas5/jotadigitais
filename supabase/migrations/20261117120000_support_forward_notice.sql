-- 1. Encaminhar um chamado para o Jota (status "Aguardando o Jota") avisa no sininho dele.
--    Se a Lay respondeu e avisou no mesmo instante, não repete o aviso.
-- 2. No "Ver como o Jota", a desenvolvedora vê o sininho dele (o banco só libera para ela, e só para ler).

create or replace function public.notify_admin_on_forward()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'waiting' or old.status = 'waiting' or new.internal
     or public.current_admin_role() is distinct from 'developer' then
    return new;
  end if;
  if exists (
    select 1 from public.notifications n
    where n.kind = 'support'
      and n.recipient_role = 'admin'
      and n.link = '/admin/suporte/' || new.id::text
      and n.created_at > now() - interval '2 minutes'
  ) then
    return new;
  end if;
  perform public.notify_admin_about_ticket(
    new.id,
    'Layra encaminhou para você: ' || new.title,
    'Está aguardando a sua análise, resposta ou aprovação.'
  );
  return new;
end;
$$;

revoke all on function public.notify_admin_on_forward() from public, anon, authenticated;

drop trigger if exists support_tickets_notify_forward on public.support_tickets;
create trigger support_tickets_notify_forward after update of status on public.support_tickets
  for each row execute function public.notify_admin_on_forward();

/** Sininho do Jota (avisos de todos e os só dele), para a desenvolvedora ver como ele vê. */
create or replace function public.list_admin_notifications(p_days integer default 30, p_limit integer default 50)
returns table (id uuid, kind text, title text, body text, link text, created_at timestamptz)
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
    select n.id, n.kind, n.title, n.body, n.link, n.created_at
    from public.notifications n
    where (n.recipient_role is null or n.recipient_role = 'admin')
      and n.created_at >= now() - make_interval(days => least(greatest(p_days, 1), 90))
    order by n.created_at desc
    limit least(greatest(p_limit, 1), 100);
end;
$$;

revoke all on function public.list_admin_notifications(integer, integer) from public, anon;
grant execute on function public.list_admin_notifications(integer, integer) to authenticated;
