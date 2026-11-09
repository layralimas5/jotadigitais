-- Responder uma mensagem específica do chat do chamado, como no WhatsApp.
-- reply_to_id aponta para outra resposta do mesmo chamado; quotes_opening = true cita a mensagem que abriu o chamado
-- (ela fica em support_tickets.description, não é uma linha de support_replies). Nunca os dois juntos.

alter table public.support_replies
  add column reply_to_id uuid references public.support_replies (id) on delete set null,
  add column quotes_opening boolean not null default false,
  add constraint support_replies_single_quote check (not (quotes_opening and reply_to_id is not null));

create index support_replies_reply_to_idx on public.support_replies (reply_to_id) where reply_to_id is not null;

-- A mensagem citada precisa ser do mesmo chamado: a chave estrangeira sozinha deixaria citar a de outro.
create or replace function public.check_support_reply_target()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.reply_to_id is not null and not exists (
    select 1 from public.support_replies r where r.id = new.reply_to_id and r.ticket_id = new.ticket_id
  ) then
    raise exception 'A mensagem respondida não é deste chamado.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger support_replies_check_target before insert on public.support_replies
  for each row execute function public.check_support_reply_target();

grant insert (reply_to_id, quotes_opening) on public.support_replies to authenticated;
