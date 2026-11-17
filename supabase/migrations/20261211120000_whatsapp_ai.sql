-- Atendimento com IA e caixa de conversas do WhatsApp (docs/whatsapp.md, fases 3 e 4).
-- A aba WhatsApp lê contatos e conversas; a aba Automação configura a IA. Escrita das conversas só pelas funções
-- (whatsapp-webhook e whatsapp-panel, com a chave de serviço): o painel nunca grava mensagem direto.

-- ---------------------------------------------------------------------------
-- 1. Configuração da IA (mesma linha de whatsapp_settings)
-- ---------------------------------------------------------------------------

alter table public.whatsapp_settings
  -- Começa desligada: o Jota liga depois de testar no simulador.
  add column ai_enabled boolean not null default false,
  add column ai_greeting text not null default
    'Oi! Aqui é o atendimento da Jota Digitais. Me conta o que você procura que eu te mostro as contas disponíveis.'
    check (char_length(ai_greeting) between 1 and 1000),
  add column ai_tone text not null default
    'Simpático, direto e confiante, como o Jota falando com um cliente. Frases curtas, sem formalidade, sem gíria pesada.'
    check (char_length(ai_tone) between 1 and 600),
  add column ai_instructions text not null default '' check (char_length(ai_instructions) <= 4000),
  -- always: responde 24h; off_hours: só fora do horário comercial (no horário quem responde é o Jota).
  add column ai_schedule text not null default 'always' check (ai_schedule in ('always', 'off_hours')),
  add column business_start time not null default '09:00',
  add column business_end time not null default '18:00',
  -- 0 = domingo ... 6 = sábado (igual ao extract(dow) do Postgres e ao getDay do JS).
  add column business_days smallint[] not null default '{1,2,3,4,5,6}'
    check (business_days <@ '{0,1,2,3,4,5,6}'::smallint[]),
  add column ignored_numbers text[] not null default '{}'
    check (cardinality(ignored_numbers) <= 200 and array_to_string(ignored_numbers, ',') ~ '^(\d{10,15}(,\d{10,15})*)?$'),
  add constraint whatsapp_business_hours check (business_start < business_end);

grant update (ai_enabled, ai_greeting, ai_tone, ai_instructions, ai_schedule, business_start, business_end, business_days, ignored_numbers)
  on public.whatsapp_settings to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Perguntas frequentes que a IA usa para responder
-- ---------------------------------------------------------------------------

create table public.whatsapp_faq (
  id uuid primary key default gen_random_uuid(),
  question text not null check (char_length(question) between 3 and 300),
  answer text not null check (char_length(answer) between 1 and 2000),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index whatsapp_faq_position_idx on public.whatsapp_faq (position, created_at);

create trigger whatsapp_faq_touch before update on public.whatsapp_faq
  for each row execute function public.touch_updated_at();

alter table public.whatsapp_faq enable row level security;

create policy "whatsapp faq staff all" on public.whatsapp_faq
  for all to authenticated
  using ((select public.has_permission('automation')))
  with check ((select public.has_permission('automation')));

revoke all on public.whatsapp_faq from anon, authenticated;
grant select, insert, update, delete on public.whatsapp_faq to authenticated;

-- Ponto de partida: as dúvidas que o site já responde. O Jota edita na aba Automação > IA.
insert into public.whatsapp_faq (question, answer, position) values
  ('Como recebo a conta?',
   'Assim que o pagamento é confirmado, o login, a senha e o passo a passo chegam aqui no WhatsApp, no número informado na compra.', 1),
  ('Quais as formas de pagamento?', 'Pix à vista ou cartão de crédito em até 12x (com juros da operadora).', 2),
  ('Tem garantia?',
   'Tem. Se a conta não estiver como anunciada na entrega (por exemplo, sem o Shop ativo), você recebe outra ou o dinheiro de volta dentro do prazo de garantia.', 3),
  ('Posso mudar o nome, o @ e a foto da conta?',
   'Pode. Depois da compra a conta é sua: você muda nome de usuário, foto e bio como quiser.', 4),
  ('Vou perder seguidores quando trocar os dados?',
   'Não. Os seguidores são reais e brasileiros e continuam na conta depois da troca de nome e foto.', 5),
  ('O que é o Shop piloto?',
   'Contas de TikTok com menos de 2.000 seguidores ficam no modo piloto do TikTok Shop. Tudo funciona, só alguns produtos ainda não liberam afiliação até a conta crescer.', 6),
  ('O nicho da conta importa?', 'Não. Você pode mudar o tipo de conteúdo e falar com qualquer público.', 7);

-- ---------------------------------------------------------------------------
-- 3. Contatos: uma linha por número que falou com a loja
-- ---------------------------------------------------------------------------

create table public.whatsapp_contacts (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique check (phone ~ '^\d{10,15}$'),
  name text check (name is null or char_length(name) between 1 and 120),
  -- lead: interessado; customer: já comprou; affiliate e student chegam com os módulos do aditivo.
  kind text not null default 'lead' check (kind in ('lead', 'customer', 'affiliate', 'student')),
  -- Quem responde agora: a IA ou a equipe (depois de assumir ou de a IA passar a conversa).
  handler text not null default 'ai' check (handler in ('ai', 'staff')),
  -- O cliente pediu para parar as mensagens automáticas ("parar").
  opted_out boolean not null default false,
  -- Resumo que a IA escreveu quando passou a conversa para o Jota.
  handoff_summary text check (handoff_summary is null or char_length(handoff_summary) <= 1000),
  unread_count integer not null default 0 check (unread_count >= 0),
  -- Última mensagem do cliente: abre a janela de 24h da Meta para responder com texto livre.
  last_inbound_at timestamptz,
  last_message_at timestamptz not null default now(),
  last_message_preview text check (last_message_preview is null or char_length(last_message_preview) <= 160),
  created_at timestamptz not null default now()
);

create index whatsapp_contacts_recent_idx on public.whatsapp_contacts (last_message_at desc);

alter table public.whatsapp_contacts enable row level security;

create policy "whatsapp contacts staff read" on public.whatsapp_contacts
  for select to authenticated using ((select public.has_permission('automation')));

create policy "whatsapp contacts staff update" on public.whatsapp_contacts
  for update to authenticated
  using ((select public.has_permission('automation')))
  with check ((select public.has_permission('automation')));

revoke all on public.whatsapp_contacts from anon, authenticated;
grant select on public.whatsapp_contacts to authenticated;
-- O painel muda só quem atende, o tipo, o nome e o "lido". O resto vem das funções.
grant update (name, kind, handler, unread_count, handoff_summary) on public.whatsapp_contacts to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Conversa: cada mensagem que entrou ou saiu
-- ---------------------------------------------------------------------------

create table public.whatsapp_chat (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.whatsapp_contacts (id) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  -- customer: o cliente; ai: a IA; staff: o Jota pelo painel; system: entrega e avisos automáticos.
  author text not null check (author in ('customer', 'ai', 'staff', 'system')),
  body text not null check (char_length(body) between 1 and 4096),
  -- test: registrado sem sair (modo teste); received: mensagem do cliente.
  status text not null default 'sent' check (status in ('received', 'test', 'sent', 'failed')),
  error text check (error is null or char_length(error) <= 1000),
  wa_message_id text unique,
  created_at timestamptz not null default now(),
  constraint whatsapp_chat_direction_author check ((direction = 'in') = (author = 'customer'))
);

create index whatsapp_chat_contact_idx on public.whatsapp_chat (contact_id, created_at);

alter table public.whatsapp_chat enable row level security;

create policy "whatsapp chat staff read" on public.whatsapp_chat
  for select to authenticated using ((select public.has_permission('automation')));

revoke all on public.whatsapp_chat from anon, authenticated;
grant select on public.whatsapp_chat to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Mensagem recebida: contato, conversa e contador numa transação só
-- ---------------------------------------------------------------------------

/**
 * Chamada pelas funções (chave de serviço) a cada mensagem do cliente. A Meta reenvia o mesmo evento quando não
 * recebe 200 a tempo: com o mesmo wa_message_id nada é gravado de novo e `duplicate` volta verdadeiro.
 * Quem já tem pedido pago ou entregue com esse WhatsApp entra como cliente.
 */
create or replace function public.whatsapp_register_inbound(p_phone text, p_name text, p_body text, p_wa_message_id text)
returns table (contact_id uuid, is_new boolean, duplicate boolean, handler text, opted_out boolean, unread_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  contact public.whatsapp_contacts;
  created boolean := false;
  bought boolean;
begin
  if p_wa_message_id is not null and exists (select 1 from public.whatsapp_chat c where c.wa_message_id = p_wa_message_id) then
    select * into contact from public.whatsapp_contacts c where c.phone = p_phone;
    return query select contact.id, false, true, contact.handler, contact.opted_out, contact.unread_count;
    return;
  end if;

  bought := exists (
    select 1 from public.orders o
    where o.status in ('paid', 'delivered')
      and o.customer_whatsapp is not null
      and right(regexp_replace(o.customer_whatsapp, '\D', '', 'g'), 11) = right(p_phone, 11)
  );

  insert into public.whatsapp_contacts as wc (phone, name, kind)
  values (p_phone, nullif(left(trim(coalesce(p_name, '')), 120), ''), case when bought then 'customer' else 'lead' end)
  on conflict (phone) do nothing
  returning * into contact;
  created := contact.id is not null;

  if not created then
    select * into contact from public.whatsapp_contacts c where c.phone = p_phone for update;
  end if;

  insert into public.whatsapp_chat (contact_id, direction, author, body, status, wa_message_id)
  values (contact.id, 'in', 'customer', left(p_body, 4096), 'received', p_wa_message_id);

  update public.whatsapp_contacts c
  set unread_count = c.unread_count + 1,
      last_inbound_at = now(),
      last_message_at = now(),
      last_message_preview = left(p_body, 160),
      name = coalesce(c.name, nullif(left(trim(coalesce(p_name, '')), 120), '')),
      kind = case when c.kind = 'lead' and bought then 'customer' else c.kind end
  where c.id = contact.id
  returning * into contact;

  return query select contact.id, created, false, contact.handler, contact.opted_out, contact.unread_count;
end;
$$;

revoke all on function public.whatsapp_register_inbound(text, text, text, text) from public, anon, authenticated;
grant execute on function public.whatsapp_register_inbound(text, text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 6. Aviso no celular quando a conversa precisa do Jota
-- ---------------------------------------------------------------------------

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('order', 'payment', 'news', 'privacy', 'security', 'support', 'whatsapp'));

alter table public.push_preferences drop constraint if exists push_preferences_kinds_check;
alter table public.push_preferences add constraint push_preferences_kinds_check
  check (kinds <@ array['order', 'payment', 'support', 'security', 'privacy', 'news', 'whatsapp']::text[]);
