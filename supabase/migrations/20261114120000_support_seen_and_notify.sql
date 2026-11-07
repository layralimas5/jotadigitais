-- Suporte: "visto" de cada pessoa em cada chamado e avisos do suporte no sininho do Jota.
-- O visto guarda só a última vez que a pessoa abriu o chamado: mensagem anterior a isso foi vista.

-- ---------------------------------------------------------------------------
-- Visto
-- ---------------------------------------------------------------------------

create table public.support_ticket_views (
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.admin_users (user_id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (ticket_id, user_id)
);

create index support_ticket_views_user_idx on public.support_ticket_views (user_id);

alter table public.support_ticket_views enable row level security;

create policy "admins read support views" on public.support_ticket_views
  for select to authenticated using (public.can_see_support_ticket(ticket_id));

-- Gravar é só pela função abaixo: ninguém marca visto em nome do outro nem volta a data.
revoke all on public.support_ticket_views from anon, authenticated;
grant select on public.support_ticket_views to authenticated;

-- ---------------------------------------------------------------------------
-- Sininho: aviso com destinatário. Nulo continua valendo para todo mundo.
-- ---------------------------------------------------------------------------

alter table public.notifications add column recipient_role text check (recipient_role is null or recipient_role in ('admin', 'developer'));

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('order', 'news', 'privacy', 'security', 'support'));

alter policy "admins read notifications" on public.notifications
  using ((select public.is_admin()) and (recipient_role is null or recipient_role = (select public.current_admin_role())));

-- Aviso de suporte para o Jota. Chamado interno nunca avisa.
create or replace function public.notify_admin_about_ticket(p_ticket_id uuid, p_title text, p_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.support_tickets where id = p_ticket_id and internal) then
    return;
  end if;
  insert into public.notifications (kind, title, body, link, recipient_role)
  values (
    'support',
    left(p_title, 120),
    case when p_body is null then null else left(p_body, 500) end,
    '/admin/suporte/' || p_ticket_id::text,
    'admin'
  );
end;
$$;

revoke all on function public.notify_admin_about_ticket(uuid, text, text) from public, anon, authenticated;

/**
 * Marca que quem está logado viu o chamado agora. Quando é a Lay vendo algo novo do Jota
 * (o chamado que ele abriu ou resposta dele depois da última vez que ela viu) e p_notify,
 * o Jota recebe "Layra viu" no sininho. Ver de novo sem novidade não avisa.
 */
create or replace function public.mark_support_ticket_seen(p_ticket_id uuid, p_notify boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_role text := public.current_admin_role();
  previous timestamptz;
  ticket record;
  has_news boolean;
begin
  if viewer_role is null or not public.can_see_support_ticket(p_ticket_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select seen_at into previous from public.support_ticket_views where ticket_id = p_ticket_id and user_id = auth.uid();

  insert into public.support_ticket_views (ticket_id, user_id, seen_at)
  values (p_ticket_id, auth.uid(), now())
  on conflict (ticket_id, user_id) do update set seen_at = excluded.seen_at;

  if viewer_role <> 'developer' or not p_notify then
    return;
  end if;

  select t.id, t.title, t.created_at, a.role as author_role into ticket
  from public.support_tickets t
  left join public.admin_users a on a.user_id = t.created_by
  where t.id = p_ticket_id;

  has_news :=
    (ticket.author_role = 'admin' and (previous is null or ticket.created_at > previous))
    or exists (
      select 1 from public.support_replies r
      join public.admin_users ra on ra.user_id = r.author_id
      where r.ticket_id = p_ticket_id and ra.role = 'admin' and (previous is null or r.created_at > previous)
    );

  if has_news then
    perform public.notify_admin_about_ticket(p_ticket_id, 'Layra viu: ' || ticket.title, 'Ela já está por dentro do que você mandou.');
  end if;
end;
$$;

revoke all on function public.mark_support_ticket_seen(uuid, boolean) from public, anon;
grant execute on function public.mark_support_ticket_seen(uuid, boolean) to authenticated;

/** A Lay escolhe avisar o Jota quando abre um chamado ou responde. O texto sai do banco, não do navegador. */
create or replace function public.notify_admin_support(p_ticket_id uuid, p_event text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ticket_title text;
  last_body text;
begin
  if public.current_admin_role() is distinct from 'developer' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_event not in ('opened', 'replied') then
    raise exception 'invalid_event' using errcode = '22023';
  end if;

  select title into ticket_title from public.support_tickets where id = p_ticket_id;
  if ticket_title is null then
    raise exception 'ticket_not_found' using errcode = 'P0002';
  end if;

  if p_event = 'opened' then
    select description into last_body from public.support_tickets where id = p_ticket_id;
    perform public.notify_admin_about_ticket(p_ticket_id, 'Layra abriu um chamado: ' || ticket_title, last_body);
  else
    select r.body into last_body from public.support_replies r
    where r.ticket_id = p_ticket_id and r.author_id = auth.uid()
    order by r.created_at desc limit 1;
    perform public.notify_admin_about_ticket(p_ticket_id, 'Layra respondeu: ' || ticket_title, last_body);
  end if;
end;
$$;

revoke all on function public.notify_admin_support(uuid, text) from public, anon;
grant execute on function public.notify_admin_support(uuid, text) to authenticated;

-- Quem abre ou responde já viu o chamado até ali.
create or replace function public.mark_seen_by(p_ticket_id uuid, p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.support_ticket_views (ticket_id, user_id, seen_at)
  select p_ticket_id, p_user_id, now() where p_user_id is not null
  on conflict (ticket_id, user_id) do update set seen_at = greatest(public.support_ticket_views.seen_at, excluded.seen_at);
$$;

revoke all on function public.mark_seen_by(uuid, uuid) from public, anon, authenticated;

create or replace function public.ticket_seen_by_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.mark_seen_by(new.id, new.created_by);
  return new;
end;
$$;

create or replace function public.reply_seen_by_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.mark_seen_by(new.ticket_id, new.author_id);
  return new;
end;
$$;

revoke all on function public.ticket_seen_by_author() from public, anon, authenticated;
revoke all on function public.reply_seen_by_author() from public, anon, authenticated;

create trigger support_tickets_seen_by_author after insert on public.support_tickets
  for each row execute function public.ticket_seen_by_author();

create trigger support_replies_seen_by_author after insert on public.support_replies
  for each row execute function public.reply_seen_by_author();

-- Chamados que já existiam contam como vistos pelos dois: o primeiro clique em cada um não vira aviso.
insert into public.support_ticket_views (ticket_id, user_id, seen_at)
select t.id, a.user_id, now()
from public.support_tickets t
cross join public.admin_users a
where a.role in ('admin', 'developer')
on conflict (ticket_id, user_id) do nothing;
