-- Aprovação do Jota: chamado em "Aguardando o Jota" pode ser aprovado e finalizado por ele.
-- Ele não ganha UPDATE na tabela: só esta função, que aceita apenas waiting -> done.
-- O histórico grava o Jota como autor dessa troca, para a Lay ver que ele aprovou.

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
  update public.support_tickets set status = 'done' where id = p_ticket_id and status = 'waiting';
  if not found then
    raise exception 'ticket_not_waiting' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.approve_support_ticket(uuid) from public, anon;
grant execute on function public.approve_support_ticket(uuid) to authenticated;

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
      -- Reabertura automática (Jota respondendo) fica sem autor: quem mudou foi o sistema.
      -- Aprovação do Jota (waiting -> done) e trocas da desenvolvedora ficam com o autor.
      case
        when actor_role = 'developer' then auth.uid()
        when actor_role = 'admin' and old.status = 'waiting' and new.status = 'done' then auth.uid()
      end
    );
  end if;
  return new;
end;
$$;

revoke all on function public.log_support_status() from public, anon, authenticated;
