-- Chamado interno: tarefa que a Lay abre para ela mesma. Fica só no painel dela; o Jota não vê
-- o chamado, a conversa, os anexos, o histórico nem os arquivos no bucket.

alter table public.support_tickets add column internal boolean not null default false;

create index support_tickets_internal_idx on public.support_tickets (internal) where internal;

grant insert (internal), update (internal) on public.support_tickets to authenticated;

-- Quem está logado pode ver este chamado? Roda como dono para as policies das tabelas filhas
-- não dependerem da policy de select do chamado.
create or replace function public.can_see_support_ticket(p_ticket_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() and exists (
    select 1 from public.support_tickets t
    where t.id = p_ticket_id
      and (not t.internal or public.current_admin_role() = 'developer')
  );
$$;

revoke all on function public.can_see_support_ticket(uuid) from public, anon;
grant execute on function public.can_see_support_ticket(uuid) to authenticated;

-- Arquivo no bucket: a primeira pasta do caminho é o id do chamado.
create or replace function public.can_see_support_file(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() and exists (
    select 1 from public.support_tickets t
    where t.id::text = split_part(p_path, '/', 1)
      and (not t.internal or public.current_admin_role() = 'developer')
  );
$$;

revoke all on function public.can_see_support_file(text) from public, anon;
grant execute on function public.can_see_support_file(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Chamados
-- ---------------------------------------------------------------------------

drop policy "admins read support tickets" on public.support_tickets;
create policy "admins read support tickets" on public.support_tickets
  for select to authenticated
  using ((select public.is_admin()) and (not internal or (select public.current_admin_role()) = 'developer'));

-- Só a desenvolvedora abre chamado interno.
drop policy "admins open support tickets" on public.support_tickets;
create policy "admins open support tickets" on public.support_tickets
  for insert to authenticated
  with check (
    (select public.is_admin())
    and created_by = (select auth.uid())
    and status = 'open'
    and (not internal or (select public.current_admin_role()) = 'developer')
  );

-- ---------------------------------------------------------------------------
-- Conversa, anexos e histórico seguem o chamado
-- ---------------------------------------------------------------------------

drop policy "admins read support replies" on public.support_replies;
create policy "admins read support replies" on public.support_replies
  for select to authenticated using (public.can_see_support_ticket(ticket_id));

drop policy "admins reply support tickets" on public.support_replies;
create policy "admins reply support tickets" on public.support_replies
  for insert to authenticated
  with check (public.can_see_support_ticket(ticket_id) and author_id = (select auth.uid()));

drop policy "admins read support attachments" on public.support_attachments;
create policy "admins read support attachments" on public.support_attachments
  for select to authenticated using (public.can_see_support_ticket(ticket_id));

drop policy "admins attach support files" on public.support_attachments;
create policy "admins attach support files" on public.support_attachments
  for insert to authenticated
  with check (
    public.can_see_support_ticket(ticket_id)
    and created_by = (select auth.uid())
    and (
      reply_id is null
      or exists (select 1 from public.support_replies r where r.id = reply_id and r.ticket_id = support_attachments.ticket_id)
    )
  );

drop policy "admins read support history" on public.support_status_events;
create policy "admins read support history" on public.support_status_events
  for select to authenticated using (public.can_see_support_ticket(ticket_id));

drop policy "admins read support files" on storage.objects;
create policy "admins read support files" on storage.objects
  for select to authenticated using (bucket_id = 'support' and public.can_see_support_file(name));

drop policy "admins upload support files" on storage.objects;
create policy "admins upload support files" on storage.objects
  for insert to authenticated with check (bucket_id = 'support' and public.can_see_support_file(name));

-- Aprovar também respeita: o Jota não aprova o que não vê.
create or replace function public.approve_support_ticket(p_ticket_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_admin_role() is distinct from 'admin' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.support_tickets set status = 'done' where id = p_ticket_id and status = 'waiting' and not internal;
  if not found then
    raise exception 'ticket_not_waiting' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.approve_support_ticket(uuid) from public, anon;
grant execute on function public.approve_support_ticket(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Chamados que a Lay já abriu e que nunca envolveram o Jota (ele não respondeu e nunca
-- ficou aguardando ele) passam a ser internos. Sem mexer na data de "mexido".
-- ---------------------------------------------------------------------------

alter table public.support_tickets disable trigger support_tickets_touch;

update public.support_tickets t
set internal = true
from public.admin_users a
where a.user_id = t.created_by
  and a.role = 'developer'
  and t.status <> 'waiting'
  and not exists (
    select 1 from public.support_replies r
    join public.admin_users ra on ra.user_id = r.author_id
    where r.ticket_id = t.id and ra.role = 'admin'
  )
  and not exists (
    select 1 from public.support_status_events e
    where e.ticket_id = t.id and (e.to_status = 'waiting' or e.from_status = 'waiting')
  );

alter table public.support_tickets enable trigger support_tickets_touch;
