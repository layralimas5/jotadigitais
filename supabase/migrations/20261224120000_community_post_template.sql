-- Modelo "Postar na comunidade" (chamado do Jota "Linkar site com a comunidade", 19/11).
-- A comunidade é um grupo de WhatsApp: o painel monta o anúncio da conta e o Jota escolhe o grupo e envia.

alter table public.message_templates drop constraint message_templates_key_check;

alter table public.message_templates add constraint message_templates_key_check
  check (key in ('order_received', 'payment_confirmed', 'order_delivered', 'crm_follow_up', 'customer_hello', 'account_offer', 'community_post'));
