-- Suporte no estilo GLPI: tipo do chamado, situação "aguardando o Jota", anexos de imagem e vídeo
-- e reabertura automática quando o Jota responde um chamado que estava esperando por ele.

-- ---------------------------------------------------------------------------
-- Tipo e situação
-- ---------------------------------------------------------------------------

alter table public.support_tickets
  add column kind text not null default 'task' check (kind in ('problem', 'improvement', 'task'));

alter table public.support_tickets drop constraint support_tickets_status_check;
alter table public.support_tickets
  add constraint support_tickets_status_check check (status in ('open', 'in_progress', 'waiting', 'done'));

grant insert (kind) on public.support_tickets to authenticated;

create index support_tickets_status_idx on public.support_tickets (status);

-- Resposta nova sobe o chamado na lista; se ele esperava o Jota e foi o Jota quem respondeu, volta para a fila da Lay.
create or replace function public.bump_support_ticket()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  author_role text;
begin
  select a.role into author_role from public.admin_users a where a.user_id = new.author_id;
  update public.support_tickets
    set updated_at = now(),
        status = case when status = 'waiting' and author_role = 'admin' then 'open' else status end
    where id = new.ticket_id;
  return new;
end;
$$;

revoke all on function public.bump_support_ticket() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Anexos (bucket privado: só quem está logado no sistema abre, por link temporário)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'support', 'support', false, 52428800,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm']
)
on conflict (id) do nothing;

create policy "admins read support files" on storage.objects
  for select to authenticated using (bucket_id = 'support' and (select public.is_admin()));

create policy "admins upload support files" on storage.objects
  for insert to authenticated with check (bucket_id = 'support' and (select public.is_admin()));

create table public.support_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  reply_id uuid references public.support_replies (id) on delete cascade,
  -- Arquivo no bucket support, sempre dentro da pasta do chamado.
  path text not null unique check (path like ticket_id::text || '/%'),
  kind text not null check (kind in ('image', 'video')),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  content_type text not null check (
    content_type in ('image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm')
  ),
  size_bytes integer not null check (size_bytes between 1 and 52428800),
  created_by uuid default auth.uid() references public.admin_users (user_id) on delete set null,
  created_at timestamptz not null default now()
);

create index support_attachments_ticket_idx on public.support_attachments (ticket_id, created_at);
create index support_attachments_reply_idx on public.support_attachments (reply_id);
create index support_attachments_created_by_idx on public.support_attachments (created_by);

alter table public.support_attachments enable row level security;

create policy "admins read support attachments" on public.support_attachments
  for select to authenticated using ((select public.is_admin()));

-- A resposta do anexo tem de ser do mesmo chamado.
create policy "admins attach support files" on public.support_attachments
  for insert to authenticated
  with check (
    (select public.is_admin())
    and created_by = (select auth.uid())
    and (
      reply_id is null
      or exists (select 1 from public.support_replies r where r.id = reply_id and r.ticket_id = support_attachments.ticket_id)
    )
  );

revoke all on public.support_attachments from anon, authenticated;
grant select on public.support_attachments to authenticated;
grant insert (ticket_id, reply_id, path, kind, name, content_type, size_bytes) on public.support_attachments to authenticated;
