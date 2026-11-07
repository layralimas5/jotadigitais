-- Suporte: chamados que o Jota abre para a Lay (ajustes no sistema ou no site) e a conversa de cada um.
-- Os dois usuários abrem e respondem; só a desenvolvedora muda a situação (aberto, em andamento, resolvido).
-- Autor e respostas ficam presos ao usuário logado: ninguém escreve em nome do outro.

-- Papel de quem está logado, só para administradores válidos (mesmas regras de sessão do is_admin).
create or replace function public.current_admin_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select a.role from public.admin_users a where a.user_id = auth.uid() and public.is_admin();
$$;

revoke all on function public.current_admin_role() from public, anon;
grant execute on function public.current_admin_role() to authenticated;

-- ---------------------------------------------------------------------------
-- Chamados
-- ---------------------------------------------------------------------------

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 3 and 120),
  description text not null check (char_length(btrim(description)) between 10 and 4000),
  area text not null check (area in ('system', 'site')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'urgent')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'done')),
  created_by uuid default auth.uid() references public.admin_users (user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index support_tickets_updated_at_idx on public.support_tickets (updated_at desc);
create index support_tickets_created_by_idx on public.support_tickets (created_by);

alter table public.support_tickets enable row level security;

create policy "admins read support tickets" on public.support_tickets
  for select to authenticated using ((select public.is_admin()));

create policy "admins open support tickets" on public.support_tickets
  for insert to authenticated
  with check ((select public.is_admin()) and created_by = (select auth.uid()) and status = 'open');

create policy "developer updates support status" on public.support_tickets
  for update to authenticated
  using ((select public.current_admin_role()) = 'developer')
  with check ((select public.current_admin_role()) = 'developer');

-- Abrir preenche só o conteúdo; mudar, só a situação. Apagar não existe: o histórico fica.
revoke all on public.support_tickets from anon, authenticated;
grant select on public.support_tickets to authenticated;
grant insert (title, description, area, priority) on public.support_tickets to authenticated;
grant update (status) on public.support_tickets to authenticated;

create or replace function public.touch_support_ticket()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if new.status is distinct from old.status then
    new.resolved_at := case when new.status = 'done' then now() end;
  end if;
  return new;
end;
$$;

create trigger support_tickets_touch
  before update on public.support_tickets
  for each row execute function public.touch_support_ticket();

-- ---------------------------------------------------------------------------
-- Respostas
-- ---------------------------------------------------------------------------

create table public.support_replies (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  author_id uuid default auth.uid() references public.admin_users (user_id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index support_replies_ticket_idx on public.support_replies (ticket_id, created_at);
create index support_replies_author_idx on public.support_replies (author_id);

alter table public.support_replies enable row level security;

create policy "admins read support replies" on public.support_replies
  for select to authenticated using ((select public.is_admin()));

create policy "admins reply support tickets" on public.support_replies
  for insert to authenticated
  with check ((select public.is_admin()) and author_id = (select auth.uid()));

revoke all on public.support_replies from anon, authenticated;
grant select on public.support_replies to authenticated;
grant insert (ticket_id, body) on public.support_replies to authenticated;

-- Resposta nova sobe o chamado na lista. Roda como dono porque o Jota não pode mexer no chamado direto.
create or replace function public.bump_support_ticket()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.support_tickets set updated_at = now() where id = new.ticket_id;
  return new;
end;
$$;

revoke all on function public.bump_support_ticket() from public, anon, authenticated;

create trigger support_replies_bump_ticket
  after insert on public.support_replies
  for each row execute function public.bump_support_ticket();
