// Entrega do acesso pelo WhatsApp (docs/whatsapp.md, fase 2). Usado pela whatsapp-send (aviso de pagamento e
// entrega direta quando a janela de 24h já está aberta) e pelo atendimento (toque em "Receber meu acesso" ou
// mensagem da página do pedido com o código).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.117.3";
import { DEFAULT_MESSAGE_TEMPLATES, fillDeliveryTemplate, type DeliveryLoginValues } from "./message-template.ts";
import { MASKED_SECRET, WRONG_PHONE_REPLY, firstName, joinHandles, samePhone, type PaymentPromptValues } from "./whatsapp-delivery.ts";
import { conversationLink, handOff, notify, recordOutbound } from "./whatsapp-outbound.ts";

const STORE_NAME = "Jota Digitais";

const PLATFORM_LABEL: Record<string, string> = { tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube", facebook: "Facebook" };

export interface DeliveryItem {
  order_id: string;
  code: string;
  cart_code: string | null;
  customer_name: string;
  customer_whatsapp: string | null;
  account_handle: string;
  account_platform: string;
  total_cents: number;
  email: string | null;
  email_password: string | null;
  profile_username: string | null;
  profile_password: string | null;
}

/**
 * delivered: acesso enviado (ou registrado, no modo teste). wrong_phone: o código é de pedido feito com outro número.
 * not_ready: pedido inexistente ou ainda sem pagamento; a mensagem segue para o atendimento comum.
 * failed: a Meta recusou o envio; a conversa foi para o Jota.
 */
export type AccessOutcome = "delivered" | "wrong_phone" | "not_ready" | "failed";

const formatBRL = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

/** O pedido e os outros do mesmo carrinho já pagos ou entregues, com o login aberto de cada conta. */
export async function deliveryItems(admin: SupabaseClient, orderId: string): Promise<DeliveryItem[]> {
  const { data, error } = await admin.rpc("whatsapp_delivery_items", { p_order_id: orderId });
  if (error) throw error;
  return data as DeliveryItem[];
}

/** Texto "Conta entregue" salvo na aba Mensagens (ou o padrão). */
export async function deliveryTemplate(admin: SupabaseClient): Promise<string> {
  const { data, error } = await admin.from("message_templates").select("body").eq("key", "order_delivered").maybeSingle();
  if (error) throw error;
  return data?.body ?? DEFAULT_MESSAGE_TEMPLATES.order_delivered;
}

export function promptValuesOf(items: readonly DeliveryItem[]): PaymentPromptValues {
  const main = items[0]!;
  return {
    name: firstName(main.customer_name),
    orderCode: main.cart_code ?? main.code,
    accounts: joinHandles(items.map((item) => item.account_handle)),
  };
}

function loginOf(item: DeliveryItem, masked: boolean): DeliveryLoginValues {
  const secret = (value: string | null) => (value === null ? null : masked ? MASKED_SECRET : value);
  return {
    email: item.email ? { email: item.email, password: secret(item.email_password) } : null,
    profile:
      item.profile_username || item.profile_password ? { username: item.profile_username, password: secret(item.profile_password) } : null,
  };
}

/** Texto "Conta entregue" da aba Automação para uma conta. `masked` troca as senhas para o registro. */
export function deliveryText(body: string, item: DeliveryItem, masked: boolean): string {
  const values = {
    nome: firstName(item.customer_name),
    pedido: item.code,
    conta: item.account_handle,
    valor: formatBRL(item.total_cents),
    rede: PLATFORM_LABEL[item.account_platform] ?? item.account_platform,
    loja: STORE_NAME,
  };
  return fillDeliveryTemplate(body, values, loginOf(item, masked));
}

/** Registro da aba Entrega automática: o acesso de cada conta, com a senha mascarada. */
export async function logDelivery(
  admin: SupabaseClient,
  rows: readonly { orderId: string; phone: string; body: string; status: "test" | "sent" | "failed"; error: string | null; waMessageId: string | null }[],
) {
  if (rows.length === 0) return;
  const now = new Date().toISOString();
  const { error } = await admin.from("whatsapp_messages").insert(
    rows.map((row) => ({
      order_id: row.orderId,
      kind: "delivery",
      to_phone: row.phone,
      body: row.body,
      status: row.status,
      error: row.error,
      wa_message_id: row.waMessageId,
      sent_at: row.status === "failed" ? null : now,
    })),
  );
  if (error) throw error;
}

async function orderIdByCode(admin: SupabaseClient, code: string): Promise<string | null> {
  const { data, error } = await admin.from("orders").select("id").eq("code", code).maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

async function markDelivered(admin: SupabaseClient, orderIds: readonly string[]) {
  if (orderIds.length === 0) return;
  // Só pedido ainda "pago": reenviar o acesso de pedido já entregue não mexe na data da garantia.
  const { error } = await admin.from("orders").update({ status: "delivered" }).in("id", orderIds).eq("status", "paid");
  if (error) throw error;
}

interface AccessRequest {
  contactId: string;
  /** Número de quem pediu, no formato da Meta. */
  phone: string;
  name: string | null;
  code: string;
  mode: "test" | "live";
}

/**
 * Manda o acesso de cada conta do pedido (ou do carrinho) para quem pediu, se for o número da compra. Pedido pago
 * vira entregue. No modo teste só registra, com as senhas mascaradas, e não muda o pedido.
 */
export async function deliverAccess(admin: SupabaseClient, request: AccessRequest): Promise<AccessOutcome> {
  const orderId = await orderIdByCode(admin, request.code);
  const items = orderId ? await deliveryItems(admin, orderId) : [];
  if (items.length === 0) return "not_ready";

  const owner = items[0]!.customer_whatsapp;
  if (!owner || !samePhone(owner, request.phone)) {
    await recordOutbound(admin, request.contactId, request.phone, "system", WRONG_PHONE_REPLY, request.mode);
    await handOff(admin, request.contactId, request.name, `Pediu o acesso do pedido ${request.code}, mas o número não é o da compra.`);
    return "wrong_phone";
  }

  const template = await deliveryTemplate(admin);
  const sent: string[] = [];
  const failures: string[] = [];
  const log = [];
  for (const item of items) {
    const masked = deliveryText(template, item, true);
    const result = await recordOutbound(admin, request.contactId, request.phone, "system", deliveryText(template, item, false), request.mode, {
      recordedBody: masked,
    });
    log.push({ orderId: item.order_id, phone: request.phone, body: masked, ...result });
    if (result.status === "failed") failures.push(item.account_handle);
    else sent.push(item.order_id);
  }
  await logDelivery(admin, log);

  if (request.mode === "test") return failures.length > 0 ? "failed" : "delivered";

  await markDelivered(admin, sent);
  const values = promptValuesOf(items);
  if (failures.length > 0) {
    await handOff(admin, request.contactId, request.name, `O WhatsApp recusou a entrega de ${joinHandles(failures)} (pedido ${values.orderCode}). Entregue pelo card de Pedidos.`);
    return "failed";
  }
  await notify(admin, conversationLink(request.contactId), `Acesso entregue: ${values.orderCode}`, `${values.name} recebeu ${values.accounts} no WhatsApp.`);
  return "delivered";
}
