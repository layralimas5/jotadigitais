-- Suporte: etiquetas que a desenvolvedora cria (nome e cor) e escolhe por chamado,
-- e o histórico de cada troca de situação, para o andamento do chamado.

-- ---------------------------------------------------------------------------
-- Etiquetas
-- ---------------------------------------------------------------------------

create table public.support_labels (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 30),
  color text not null check (color in ('electric', 'emerald', 'amber', 'pink', 'violet', 'red', 'gray')),
  created_at timestamptz not null default now()
);

create unique index support_labels_name_key on public.support_labels (lower(btrim(name)));

alter table public.support_labels enable row level security;

create policy "admins read support labels" on public.support_labels
  for select to authenticated using ((select public.is_admin()));

create policy "developer creates support labels" on public.support_labels
  for insert to authenticated with check ((select public.current_admin_role()) = 'developer');

create policy "developer edits support labels" on public.support_labels
  for update to authenticated
  using ((select public.current_admin_role()) = 'developer')
  with check ((select public.current_admin_role()) = 'developer');

create policy "developer deletes support labels" on public.support_labels
  for delete to authenticated using ((select public.current_admin_role()) = 'developer');

revoke all on public.support_labels from anon, authenticated;
grant select, delete on public.support_labels to authenticated;
grant insert (name, color), update (name, color) on public.support_labels to authenticated;

-- Uma etiqueta por chamado. Apagar a etiqueta deixa os chamados sem.
alter table public.support_tickets
  add column label_id uuid references public.support_labels (id) on delete set null;

create index support_tickets_label_idx on public.support_tickets (label_id);

-- A política de update do chamado já é só da desenvolvedora; aqui só se abre a coluna.
grant update (label_id) on public.support_tickets to authenticated;

-- ---------------------------------------------------------------------------
-- Histórico de situação
-- ---------------------------------------------------------------------------

create table public.support_status_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  from_status text check (from_status in ('open', 'in_progress', 'waiting', 'done')),
  to_status text not null check (to_status in ('open', 'in_progress', 'waiting', 'done')),
  -- Nulo quando a troca foi automática (resposta do Jota reabrindo) ou o usuário foi removido.
  author_id uuid references public.admin_users (user_id) on delete set null,
  created_at timestamptz not null default now()
);

create index support_status_events_ticket_idx on public.support_status_events (ticket_id, created_at);
create index support_status_events_author_idx on public.support_status_events (author_id);

alter table public.support_status_events enable row level security;

create policy "admins read support history" on public.support_status_events
  for select to authenticated using ((select public.is_admin()));

-- Só o gatilho escreve: ninguém grava ou apaga histórico pelo painel.
revoke all on public.support_status_events from anon, authenticated;
grant select on public.support_status_events to authenticated;

create or replace function public.log_support_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    insert into public.support_status_events (ticket_id, from_status, to_status, author_id)
    values (
      new.id,
      old.status,
      new.status,
      -- Na reabertura automática quem está logado é o Jota respondendo, mas quem mudou foi o sistema.
      case when (select a.role from public.admin_users a where a.user_id = auth.uid()) = 'developer' then auth.uid() end
    );
  end if;
  return new;
end;
$$;

revoke all on function public.log_support_status() from public, anon, authenticated;

create trigger support_tickets_log_status
  after update of status on public.support_tickets
  for each row execute function public.log_support_status();
