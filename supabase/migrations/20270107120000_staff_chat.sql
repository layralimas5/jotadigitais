-- Chat da Lay (developer) com o Jota (admin). O ajudante não entra.
-- Mensagens com texto ou figurinha; "visto" e não lidas pela última leitura de cada um.
-- Online e "digitando…" vão pelo Realtime, no canal privado staff-chat (policies em realtime.messages).

create table public.staff_chat_messages (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.admin_users (user_id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  sticker text check (sticker is null or sticker ~ '^[a-z0-9-]{1,40}$'),
  created_at timestamptz not null default now()
);

create index staff_chat_messages_created_idx on public.staff_chat_messages (created_at desc);
create index staff_chat_messages_author_idx on public.staff_chat_messages (author_id);

alter table public.staff_chat_messages enable row level security;

create policy "staff chat read" on public.staff_chat_messages
  for select to authenticated
  using (public.current_admin_role() in ('admin', 'developer'));

create policy "staff chat send" on public.staff_chat_messages
  for insert to authenticated
  with check (public.current_admin_role() in ('admin', 'developer') and author_id = auth.uid());

revoke all on public.staff_chat_messages from anon, authenticated;
grant select on public.staff_chat_messages to authenticated;
grant insert (body, sticker) on public.staff_chat_messages to authenticated;

-- Última vez que cada um leu o chat: dá o "visto" e a contagem de não lidas.
create table public.staff_chat_reads (
  user_id uuid primary key references public.admin_users (user_id) on delete cascade,
  last_read_at timestamptz not null default now()
);

alter table public.staff_chat_reads enable row level security;

create policy "staff chat reads read" on public.staff_chat_reads
  for select to authenticated
  using (public.current_admin_role() in ('admin', 'developer'));

revoke all on public.staff_chat_reads from anon, authenticated;
grant select on public.staff_chat_reads to authenticated;

create or replace function public.mark_staff_chat_read()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(public.current_admin_role(), '') not in ('admin', 'developer') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.staff_chat_reads (user_id, last_read_at)
  values (auth.uid(), now())
  on conflict (user_id) do update set last_read_at = excluded.last_read_at;
end;
$$;

revoke all on function public.mark_staff_chat_read() from public, anon;
grant execute on function public.mark_staff_chat_read() to authenticated;

-- Aviso no sininho e no celular só na primeira mensagem que o outro ainda não leu (sem chuva de notificação).
create or replace function public.notify_staff_chat_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  author_role text := (select a.role from public.admin_users a where a.user_id = new.author_id);
  recipient_role text;
  recipient_read timestamptz;
  pending_before boolean;
begin
  if coalesce(author_role, '') not in ('admin', 'developer') then
    return new;
  end if;
  recipient_role := case when author_role = 'developer' then 'admin' else 'developer' end;
  select max(r.last_read_at) into recipient_read
    from public.staff_chat_reads r
    join public.admin_users a on a.user_id = r.user_id
   where a.role = recipient_role;
  select exists (
    select 1 from public.staff_chat_messages m
     where m.id <> new.id
       and m.author_id = new.author_id
       and m.created_at > coalesce(recipient_read, '-infinity'::timestamptz)
  ) into pending_before;
  if pending_before then
    return new;
  end if;
  insert into public.notifications (kind, title, body, link, recipient_role)
  values (
    'support',
    case when author_role = 'developer' then 'Layra te chamou no chat' else 'Jota te chamou no chat' end,
    left(new.body, 500),
    '/admin/chat',
    recipient_role
  );
  return new;
end;
$$;

revoke all on function public.notify_staff_chat_message() from public, anon, authenticated;

create trigger staff_chat_messages_notify after insert on public.staff_chat_messages
  for each row execute function public.notify_staff_chat_message();

-- Canal privado do Realtime: só a Lay e o Jota escutam e mandam presença e "digitando…".
create policy "staff chat realtime read" on realtime.messages
  for select to authenticated
  using (realtime.topic() = 'staff-chat' and public.current_admin_role() in ('admin', 'developer'));

create policy "staff chat realtime write" on realtime.messages
  for insert to authenticated
  with check (realtime.topic() = 'staff-chat' and public.current_admin_role() in ('admin', 'developer'));
