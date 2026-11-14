-- Suporte, entrega 2:
-- 1. Respostas prontas: textos que a desenvolvedora salva e insere na resposta com um clique. Só ela vê e mexe.
-- 2. Áudio no chamado: gravado na hora ou enviado (ex.: áudio salvo do WhatsApp), no mesmo bucket privado dos anexos.

-- ---------------------------------------------------------------------------
-- Respostas prontas
-- ---------------------------------------------------------------------------

create table public.support_canned_replies (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 60),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_by uuid default auth.uid() references public.admin_users (user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger support_canned_replies_touch before update on public.support_canned_replies
  for each row execute function public.touch_updated_at();

alter table public.support_canned_replies enable row level security;

create policy "developer reads canned replies" on public.support_canned_replies
  for select to authenticated using ((select public.current_admin_role()) = 'developer');
create policy "developer adds canned replies" on public.support_canned_replies
  for insert to authenticated with check ((select public.current_admin_role()) = 'developer');
create policy "developer edits canned replies" on public.support_canned_replies
  for update to authenticated
  using ((select public.current_admin_role()) = 'developer')
  with check ((select public.current_admin_role()) = 'developer');
create policy "developer deletes canned replies" on public.support_canned_replies
  for delete to authenticated using ((select public.current_admin_role()) = 'developer');

revoke all on public.support_canned_replies from anon, authenticated;
grant select, delete on public.support_canned_replies to authenticated;
grant insert (title, body) on public.support_canned_replies to authenticated;
grant update (title, body) on public.support_canned_replies to authenticated;

-- As três que a Lay pediu, para já começar com alguma.
insert into public.support_canned_replies (title, body, created_by) values
  ('Publicado', 'Publicado! Confere aí e, se estiver tudo certo, é só clicar em "Aprovado e finalizado".', null),
  ('Preciso de um print', 'Consegue me mandar um print da tela onde aconteceu? Se puder, mostra também o que você clicou antes.', null),
  ('Depende do contador', 'Essa parte depende do contador. Assim que você tiver a resposta dele, me manda aqui que eu sigo.', null);

-- ---------------------------------------------------------------------------
-- Áudio nos anexos
-- ---------------------------------------------------------------------------

alter table public.support_attachments drop constraint support_attachments_kind_check;
alter table public.support_attachments add constraint support_attachments_kind_check
  check (kind in ('image', 'video', 'audio'));

alter table public.support_attachments drop constraint support_attachments_content_type_check;
alter table public.support_attachments add constraint support_attachments_content_type_check
  check (
    content_type in (
      'image/png', 'image/jpeg', 'image/webp', 'image/gif',
      'video/mp4', 'video/quicktime', 'video/webm',
      'audio/webm', 'audio/ogg', 'audio/opus', 'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/x-m4a', 'audio/wav'
    )
  );

update storage.buckets
  set allowed_mime_types = array[
    'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'video/mp4', 'video/quicktime', 'video/webm',
    'audio/webm', 'audio/ogg', 'audio/opus', 'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/x-m4a', 'audio/wav'
  ]
  where id = 'support';
