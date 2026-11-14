-- Suporte, entrega 1:
-- 1. Checklist dentro do chamado: a desenvolvedora quebra o pedido em itens e marca cada um; o Jota acompanha.
-- 2. Previsão de entrega e "No ar desde": a desenvolvedora define a previsão e marca quando publicou.
--    Marcar como publicado avisa o Jota no sininho e passa o chamado para "Aguardando o Jota" (ele confere e aprova).

-- ---------------------------------------------------------------------------
-- Checklist
-- ---------------------------------------------------------------------------

create table public.support_checklist_items (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 200),
  done boolean not null default false,
  position integer not null default 0,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create index support_checklist_items_ticket_idx on public.support_checklist_items (ticket_id, position);

create or replace function public.touch_support_checklist_item()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.done is distinct from old.done then
    new.done_at := case when new.done then now() end;
  end if;
  return new;
end;
$$;

create trigger support_checklist_items_touch
  before insert or update on public.support_checklist_items
  for each row execute function public.touch_support_checklist_item();

alter table public.support_checklist_items enable row level security;

-- Quem vê o chamado vê a checklist dele (chamado interno continua só da desenvolvedora).
create policy "admins read support checklist" on public.support_checklist_items
  for select to authenticated using ((select public.can_see_support_ticket(ticket_id)));
create policy "developer adds support checklist" on public.support_checklist_items
  for insert to authenticated
  with check ((select public.current_admin_role()) = 'developer' and (select public.can_see_support_ticket(ticket_id)));
create policy "developer edits support checklist" on public.support_checklist_items
  for update to authenticated
  using ((select public.current_admin_role()) = 'developer')
  with check ((select public.current_admin_role()) = 'developer');
create policy "developer deletes support checklist" on public.support_checklist_items
  for delete to authenticated using ((select public.current_admin_role()) = 'developer');

revoke all on public.support_checklist_items from anon, authenticated;
grant select, delete on public.support_checklist_items to authenticated;
grant insert (ticket_id, body, position) on public.support_checklist_items to authenticated;
grant update (body, done, position) on public.support_checklist_items to authenticated;

-- ---------------------------------------------------------------------------
-- Previsão e publicação
-- ---------------------------------------------------------------------------

alter table public.support_tickets
  add column due_date date,
  add column released_at timestamptz;

/** Previsão de entrega (ou nula para tirar). Só a desenvolvedora. */
create or replace function public.set_support_ticket_due_date(p_ticket_id uuid, p_due_date date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_admin_role() is distinct from 'developer' or not public.can_see_support_ticket(p_ticket_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.support_tickets set due_date = p_due_date where id = p_ticket_id;
end;
$$;

revoke all on function public.set_support_ticket_due_date(uuid, date) from public, anon;
grant execute on function public.set_support_ticket_due_date(uuid, date) to authenticated;

/**
 * Marca (ou desmarca) que o ajuste já está no ar. Ao marcar, o Jota recebe o aviso no sininho e o chamado
 * que ainda estava na fila passa para "Aguardando o Jota". O aviso sai antes da troca de situação,
 * então o aviso de "encaminhou para você" não se repete.
 */
create or replace function public.set_support_ticket_released(p_ticket_id uuid, p_released boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ticket record;
begin
  if public.current_admin_role() is distinct from 'developer' or not public.can_see_support_ticket(p_ticket_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select id, title, status, internal, released_at into ticket from public.support_tickets where id = p_ticket_id;
  if ticket.id is null then
    raise exception 'ticket_not_found' using errcode = 'P0002';
  end if;

  if not p_released then
    update public.support_tickets set released_at = null where id = p_ticket_id;
    return;
  end if;
  if ticket.released_at is not null then
    return;
  end if;

  update public.support_tickets set released_at = now() where id = p_ticket_id;
  perform public.notify_admin_about_ticket(
    p_ticket_id,
    'Já está no ar: ' || ticket.title,
    'Confere no site ou no painel e, se estiver tudo certo, aprova o chamado.'
  );
  -- Chamado interno não fica aguardando o Jota: ele não vê (o aviso também não sai, notify_admin_about_ticket ignora interno).
  if ticket.status in ('open', 'in_progress') and not ticket.internal then
    update public.support_tickets set status = 'waiting' where id = p_ticket_id;
  end if;
end;
$$;

revoke all on function public.set_support_ticket_released(uuid, boolean) from public, anon;
grant execute on function public.set_support_ticket_released(uuid, boolean) to authenticated;
