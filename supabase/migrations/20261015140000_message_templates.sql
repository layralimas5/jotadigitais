-- Modelos de mensagem do WhatsApp: hoje preenchem os botões de conversa do painel;
-- depois, os mesmos textos alimentam o envio automático. Só administradores leem e escrevem.

create table public.message_templates (
  key text primary key check (key in ('order_received', 'payment_confirmed', 'order_delivered', 'crm_follow_up', 'customer_hello')),
  body text not null check (char_length(body) between 1 and 1000),
  updated_at timestamptz not null default now()
);

create trigger message_templates_touch before update on public.message_templates
  for each row execute function public.touch_updated_at();

alter table public.message_templates enable row level security;

create policy "admins read message templates" on public.message_templates
  for select to authenticated using (public.is_admin());

create policy "admins insert message templates" on public.message_templates
  for insert to authenticated with check (public.is_admin());

create policy "admins update message templates" on public.message_templates
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.message_templates from anon;
