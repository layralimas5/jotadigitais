-- O Jota e a desenvolvedora trocam a prioridade de um chamado ainda não finalizado,
-- mesmo que ele tenha sido aberto pelo outro e com outra prioridade.
-- A coluna continua sem permissão de update direto: a troca passa só por aqui.

create or replace function public.set_support_ticket_priority(p_ticket_id uuid, p_priority text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
begin
  if public.current_admin_role() not in ('admin', 'developer') or not public.can_see_support_ticket(p_ticket_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_priority not in ('low', 'normal', 'urgent') then
    raise exception 'invalid_priority' using errcode = '22023';
  end if;
  select status into current_status from public.support_tickets where id = p_ticket_id;
  if current_status is null then
    raise exception 'ticket_not_found' using errcode = 'P0002';
  end if;
  if current_status = 'done' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.support_tickets set priority = p_priority where id = p_ticket_id and priority <> p_priority;
end;
$$;

revoke all on function public.set_support_ticket_priority(uuid, text) from public, anon;
grant execute on function public.set_support_ticket_priority(uuid, text) to authenticated;
