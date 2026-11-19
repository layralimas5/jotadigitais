-- Proteções da automação do WhatsApp antes de ligar de verdade (docs/whatsapp.md, "Proteções").
-- LGPD: conversas entram na retenção (12 meses sem mensagem) e no "apagar meus dados" do titular. As funções abaixo são
-- as da 20261031120000_checkout_without_email com as linhas do WhatsApp a mais; o resto não muda.

-- ---------------------------------------------------------------------------
-- 1. Titular pede para apagar: conversas do WhatsApp vão junto
-- ---------------------------------------------------------------------------

create or replace function public.anonymize_data_subject(p_contact text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  contact_email text;
  contact_whatsapp text;
  owned uuid[];
  removable uuid[];
  anonymized integer;
  kept integer;
  deleted_customers integer;
  deleted_conversations integer;
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  select email, whatsapp into contact_email, contact_whatsapp from public.parse_contact(p_contact);
  if not (
    coalesce(contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$', false)
    or coalesce(contact_whatsapp ~ '^\d{10,13}$', false)
  ) then
    raise exception 'invalid_contact' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(id), '{}') into owned from public.orders
    where customer_email = contact_email or customer_whatsapp = contact_whatsapp;

  select coalesce(array_agg(id), '{}') into removable from public.orders
    where id = any(owned) and (status = 'canceled' or (status = 'awaiting_payment' and expires_at <= now()));
  anonymized := public.anonymize_orders(removable);

  update public.orders set customer_instagram = null
    where id = any(owned) and status in ('paid', 'delivered', 'awaiting_payment');
  select count(*) into kept from public.orders where id = any(owned) and not (id = any(removable));

  delete from public.customers
    where lower(email) = contact_email or regexp_replace(coalesce(whatsapp, ''), '\D', '', 'g') = contact_whatsapp;
  get diagnostics deleted_customers = row_count;

  -- Conversas do WhatsApp do titular (com ou sem o nono dígito); a mensagem some junto (on delete cascade).
  delete from public.whatsapp_contacts
    where contact_whatsapp is not null and public.whatsapp_phone_key(phone) = public.whatsapp_phone_key(contact_whatsapp);
  get diagnostics deleted_conversations = row_count;

  result := jsonb_build_object(
    'anonymized_orders', anonymized, 'kept_orders', kept, 'deleted_customers', deleted_customers,
    'deleted_whatsapp_conversations', deleted_conversations
  );
  perform public.record_audit('anonymize', 'data_subject', public.hash_pii(coalesce(contact_email, contact_whatsapp)), result);
  return result;
end;
$$;

revoke all on function public.anonymize_data_subject(text) from public, anon;
grant execute on function public.anonymize_data_subject(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Retenção: conversa parada há 12 meses é apagada (Política de Privacidade, seção 8)
-- ---------------------------------------------------------------------------

create or replace function public.run_retention_policy()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  expired uuid[];
  anonymized integer;
  deleted_leads integer;
  deleted_notifications integer;
  deleted_requests integer;
  deleted_attempts integer;
  deleted_audit integer;
  deleted_conversations integer;
  deleted_whatsapp_log integer;
begin
  select coalesce(array_agg(id), '{}') into expired from public.orders
    where coalesce(customer_email, '') not like '%@anonimizado.invalid'
      and (
        ((status = 'canceled' or (status = 'awaiting_payment' and expires_at <= now())) and created_at < now() - interval '6 months')
        or (status in ('paid', 'delivered') and created_at < now() - interval '5 years')
      );
  anonymized := public.anonymize_orders(expired);

  delete from public.leads where stage <> 'won' and updated_at < now() - interval '12 months';
  get diagnostics deleted_leads = row_count;

  delete from public.notifications where kind in ('order', 'privacy', 'security') and created_at < now() - interval '90 days';
  get diagnostics deleted_notifications = row_count;

  delete from public.data_requests where status <> 'open' and created_at < now() - interval '5 years';
  get diagnostics deleted_requests = row_count;

  delete from public.rate_limit_hits where created_at < now() - interval '30 days';
  get diagnostics deleted_attempts = row_count;

  delete from public.audit_events where created_at < now() - interval '1 year';
  get diagnostics deleted_audit = row_count;

  -- WhatsApp: conversa parada há 12 meses some inteira; o registro de envios (senhas já mascaradas) também.
  delete from public.whatsapp_contacts where last_message_at < now() - interval '12 months';
  get diagnostics deleted_conversations = row_count;
  delete from public.whatsapp_messages where created_at < now() - interval '12 months';
  get diagnostics deleted_whatsapp_log = row_count;
  delete from public.notifications where kind = 'whatsapp' and created_at < now() - interval '90 days';

  return jsonb_build_object(
    'anonymized_orders', anonymized,
    'deleted_leads', deleted_leads,
    'deleted_notifications', deleted_notifications,
    'deleted_requests', deleted_requests,
    'deleted_attempts', deleted_attempts,
    'deleted_audit_events', deleted_audit,
    'deleted_whatsapp_conversations', deleted_conversations,
    'deleted_whatsapp_log', deleted_whatsapp_log
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Retenção sozinha todo dia, com o pg_cron ligado (sem ele, segue o botão do painel)
-- ---------------------------------------------------------------------------

do $do$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('lgpd-retencao', '30 6 * * *', 'select public.run_retention_policy()');
  end if;
end;
$do$;
