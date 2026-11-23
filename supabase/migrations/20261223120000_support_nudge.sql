-- Suporte: a desenvolvedora cobra o Jota num chamado que está "Aguardando o Jota" (depende dele para conferir,
-- aprovar e finalizar). Cada cobrança fica registrada (o painel mostra quantas vezes e quando foi a última)
-- e vira aviso no sininho e no celular dele. Uma cobrança por hora em cada chamado, para o aviso não virar ruído.
-- Tabela própria em vez de coluna no chamado: cobrar não mexe no updated_at (o "parado há X dias" continua certo).
-- created_by aponta para auth.users, não para admin_users: assim não nasce um segundo caminho
-- support_tickets <-> admin_users no PostgREST (foi o que quebrou o Suporte com PGRST201 em 07/11).

create table public.support_nudges (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index support_nudges_ticket_idx on public.support_nudges (ticket_id, created_at desc);
create index support_nudges_created_by_idx on public.support_nudges (created_by);

alter table public.support_nudges enable row level security;

create policy "admins read support nudges" on public.support_nudges
  for select to authenticated using (public.can_see_support_ticket(ticket_id));

-- Ninguém grava direto: só pela função abaixo, que confere papel, situação e intervalo.
revoke all on public.support_nudges from anon, authenticated;
grant select on public.support_nudges to authenticated;

create or replace function public.nudge_admin_support(p_ticket_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ticket record;
  waiting_since timestamptz;
  last_nudge timestamptz;
  nudges_now integer;
begin
  if public.current_admin_role() is distinct from 'developer' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select id, title, status, internal, merged_into into ticket from public.support_tickets where id = p_ticket_id for update;
  if ticket.id is null or ticket.status <> 'waiting' or ticket.internal or ticket.merged_into is not null then
    raise exception 'ticket_not_waiting' using errcode = 'P0002';
  end if;

  select max(created_at) into last_nudge from public.support_nudges where ticket_id = p_ticket_id;
  if last_nudge is not null and last_nudge > now() - interval '1 hour' then
    raise exception 'nudge_too_soon' using errcode = 'P0001';
  end if;

  insert into public.support_nudges (ticket_id, created_by) values (p_ticket_id, auth.uid());

  -- Conta só as cobranças desde que o chamado passou para "Aguardando o Jota" desta vez.
  select max(created_at) into waiting_since
  from public.support_status_events where ticket_id = p_ticket_id and to_status = 'waiting';
  select count(*) into nudges_now
  from public.support_nudges where ticket_id = p_ticket_id and created_at >= coalesce(waiting_since, '-infinity'::timestamptz);

  perform public.notify_admin_about_ticket(
    p_ticket_id,
    'Layra está cobrando: ' || ticket.title,
    'Este chamado depende de você para conferir, aprovar e finalizar.'
      || case when waiting_since is not null
           then ' Aguardando você desde ' || to_char(waiting_since at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI') || '.'
           else '' end
      || case when nudges_now > 1 then ' Esta é a ' || nudges_now || 'ª cobrança.' else '' end
  );
end;
$$;

revoke all on function public.nudge_admin_support(uuid) from public, anon;
grant execute on function public.nudge_admin_support(uuid) to authenticated;
