-- Aviso para a desenvolvedora quando o Jota (ou ajudante) abre ou responde um chamado.
-- Até aqui só a reabertura avisava a Layra; chamado novo e resposta dele não geravam linha em
-- notifications para ela, então o push (dispatch_push -> push-send) nunca chegava no celular dela.
-- Fica no banco (gatilho) para valer em qualquer caminho de criação, sem depender do navegador.

create or replace function public.notify_developer_about_ticket(p_ticket_id uuid, p_title text, p_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (kind, title, body, link, recipient_role)
  values (
    'support',
    left(p_title, 120),
    case when p_body is null then null else left(p_body, 500) end,
    '/admin/suporte/' || p_ticket_id::text,
    'developer'
  );
end;
$$;

revoke all on function public.notify_developer_about_ticket(uuid, text, text) from public, anon, authenticated;

/** Nome curto de quem escreveu, para o título do aviso. */
create or replace function public.support_author_label(p_role text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_role = 'admin' then 'Jota' else 'Equipe do Jota' end;
$$;

revoke all on function public.support_author_label(text) from public, anon, authenticated;

create or replace function public.notify_developer_on_ticket()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  author_role text := (select a.role from public.admin_users a where a.user_id = new.created_by);
  urgent_tag text := case when new.priority = 'urgent' then 'URGENTE · ' else '' end;
begin
  if new.internal or author_role is null or author_role = 'developer' then
    return new;
  end if;
  perform public.notify_developer_about_ticket(
    new.id,
    urgent_tag || public.support_author_label(author_role) || ' abriu um chamado: ' || new.title,
    new.description
  );
  return new;
end;
$$;

revoke all on function public.notify_developer_on_ticket() from public, anon, authenticated;

create or replace function public.notify_developer_on_reply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  author_role text := (select a.role from public.admin_users a where a.user_id = new.author_id);
  ticket record;
begin
  if author_role is null or author_role = 'developer' then
    return new;
  end if;
  select id, title, internal into ticket from public.support_tickets where id = new.ticket_id;
  if ticket.id is null or ticket.internal then
    return new;
  end if;
  perform public.notify_developer_about_ticket(
    ticket.id,
    public.support_author_label(author_role) || ' respondeu: ' || ticket.title,
    new.body
  );
  return new;
end;
$$;

revoke all on function public.notify_developer_on_reply() from public, anon, authenticated;

create trigger support_tickets_notify_developer after insert on public.support_tickets
  for each row execute function public.notify_developer_on_ticket();

create trigger support_replies_notify_developer after insert on public.support_replies
  for each row execute function public.notify_developer_on_reply();

/**
 * Reabrir manda o motivo como resposta antes (gatilho acima já avisou a Layra com o texto).
 * Para não chegar dois pushes, a reabertura só renomeia esse aviso recente para "Jota reabriu";
 * sem aviso recente (motivo enviado há mais de 2 minutos), cria um novo como antes.
 */
create or replace function public.reopen_support_ticket(p_ticket_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ticket record;
  reason text;
  recent_id uuid;
begin
  if public.current_admin_role() is distinct from 'admin' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select id, title, status, internal, resolved_at into ticket from public.support_tickets where id = p_ticket_id;
  if ticket.id is null or ticket.internal or ticket.status <> 'done'
     or ticket.resolved_at is null or ticket.resolved_at < now() - interval '7 days' then
    raise exception 'ticket_not_reopenable' using errcode = 'P0002';
  end if;

  update public.support_tickets set status = 'open', released_at = null where id = p_ticket_id;

  select r.body into reason from public.support_replies r
  where r.ticket_id = p_ticket_id and r.author_id = auth.uid()
  order by r.created_at desc limit 1;

  select n.id into recent_id from public.notifications n
  where n.kind = 'support' and n.recipient_role = 'developer'
    and n.link = '/admin/suporte/' || p_ticket_id::text
    and n.created_at > now() - interval '2 minutes'
  order by n.created_at desc limit 1;

  if recent_id is not null then
    update public.notifications set title = left('Jota reabriu: ' || ticket.title, 120) where id = recent_id;
  else
    perform public.notify_developer_about_ticket(p_ticket_id, 'Jota reabriu: ' || ticket.title, reason);
  end if;
end;
$$;

revoke all on function public.reopen_support_ticket(uuid) from public, anon;
grant execute on function public.reopen_support_ticket(uuid) to authenticated;
