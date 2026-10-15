-- Link do perfil e data da última busca de números (botão "Puxar dados" na ficha da conta),
-- e o modelo de mensagem para oferecer uma conta pelo WhatsApp.

alter table public.accounts
  add column profile_url text check (profile_url is null or (char_length(profile_url) <= 300 and profile_url ~ '^https://\S+$')),
  add column stats_synced_at timestamptz;

alter table public.message_templates drop constraint message_templates_key_check;

alter table public.message_templates add constraint message_templates_key_check
  check (key in ('order_received', 'payment_confirmed', 'order_delivered', 'crm_follow_up', 'customer_hello', 'account_offer'));
