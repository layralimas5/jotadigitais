-- Suporte: juntar chamados que pedem a mesma coisa. Só a desenvolvedora junta e separa.
-- Nada muda de lugar: o chamado juntado guarda em merged_into o principal, sai da lista e aparece inteiro dentro
-- dele (abertura, respostas e anexos). Separar volta tudo como era. Apagar o principal solta os juntados.

alter table public.support_tickets
  add column merged_into uuid references public.support_tickets (id) on delete set null,
  add column merged_at timestamptz,
  add constraint support_tickets_not_merged_into_self check (merged_into is distinct from id);

create index support_tickets_merged_into_idx on public.support_tickets (merged_into) where merged_into is not null;

-- A conversa continua só no principal: chamado juntado não recebe resposta nova.
create or replace function public.reject_reply_on_merged_ticket()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.support_tickets t where t.id = new.ticket_id and t.merged_into is not null) then
    raise exception 'ticket_merged' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.reject_reply_on_merged_ticket() from public, anon, authenticated;

create trigger support_replies_reject_merged before insert on public.support_replies
  for each row execute function public.reject_reply_on_merged_ticket();

-- Junta os chamados de p_sources no p_target. Quem já estava juntado num deles passa para o principal, para nunca
-- haver juntado dentro de juntado. Se entrar chamado que o Jota vê num principal interno, o principal passa a ser
-- visto por ele também: a conversa dele não pode sumir do painel.
create or replace function public.merge_support_tickets(p_target uuid, p_sources uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.support_tickets;
  v_sources uuid[];
begin
  if public.current_admin_role() is distinct from 'developer' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_sources := array(select distinct unnest(coalesce(p_sources, '{}')));
  if cardinality(v_sources) = 0 or p_target = any (v_sources) then
    raise exception 'invalid_sources' using errcode = '22023';
  end if;
  select * into v_target from public.support_tickets where id = p_target for update;
  if not found then
    raise exception 'ticket_not_found' using errcode = 'P0002';
  end if;
  if v_target.merged_into is not null then
    raise exception 'target_merged' using errcode = 'P0001';
  end if;
  if (select count(*) from public.support_tickets where id = any (v_sources)) <> cardinality(v_sources) then
    raise exception 'ticket_not_found' using errcode = 'P0002';
  end if;

  update public.support_tickets set merged_into = p_target where merged_into = any (v_sources);
  update public.support_tickets set merged_into = p_target, merged_at = now() where id = any (v_sources);

  if v_target.internal and exists (select 1 from public.support_tickets where merged_into = p_target and not internal) then
    update public.support_tickets set internal = false where id = p_target;
  end if;
end;
$$;

create or replace function public.unmerge_support_ticket(p_ticket_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_admin_role() is distinct from 'developer' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.support_tickets set merged_into = null, merged_at = null where id = p_ticket_id and merged_into is not null;
  if not found then
    raise exception 'ticket_not_found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.merge_support_tickets(uuid, uuid[]) from public, anon;
revoke all on function public.unmerge_support_ticket(uuid) from public, anon;
grant execute on function public.merge_support_tickets(uuid, uuid[]) to authenticated;
grant execute on function public.unmerge_support_ticket(uuid) to authenticated;
