-- Suporte, entrega 3: o Jota reabre um chamado finalizado há até 7 dias (o problema voltou),
-- em vez de abrir outro. O chamado volta para "Pendente" com o histórico junto e a desenvolvedora é avisada.
-- O "parado há X dias" é calculado no painel, pela última resposta ou troca de situação: não precisa de coluna.

-- O histórico passa a registrar o Jota como autor da reabertura (finalizado -> pendente).
create or replace function public.log_support_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text := (select a.role from public.admin_users a where a.user_id = auth.uid());
begin
  if new.status is distinct from old.status then
    insert into public.support_status_events (ticket_id, from_status, to_status, author_id)
    values (
      new.id,
      old.status,
      new.status,
      -- Reabertura automática (Jota respondendo um chamado que aguardava ele) fica sem autor: quem mudou foi o sistema.
      -- Aprovação do Jota (waiting -> done), reabertura pelo Jota (done -> open) e trocas da desenvolvedora ficam com o autor.
      case
        when actor_role = 'developer' then auth.uid()
        when actor_role = 'admin' and old.status = 'waiting' and new.status = 'done' then auth.uid()
        when actor_role = 'admin' and old.status = 'done' and new.status = 'open' then auth.uid()
      end
    );
  end if;
  return new;
end;
$$;

revoke all on function public.log_support_status() from public, anon, authenticated;

/**
 * O Jota reabre um chamado dele (não interno) finalizado há até 7 dias. Volta para "Pendente", perde o selo
 * "No ar" (o ajuste vai sair de novo) e a desenvolvedora recebe o aviso no sininho com o motivo,
 * que é a última mensagem dele no chamado (o painel manda o motivo como resposta antes de reabrir).
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

  insert into public.notifications (kind, title, body, link, recipient_role)
  values (
    'support',
    left('Jota reabriu: ' || ticket.title, 120),
    case when reason is null then null else left(reason, 500) end,
    '/admin/suporte/' || p_ticket_id::text,
    'developer'
  );
end;
$$;

revoke all on function public.reopen_support_ticket(uuid) from public, anon;
grant execute on function public.reopen_support_ticket(uuid) to authenticated;
