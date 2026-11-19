// Mensagens automáticas pelo WhatsApp (docs/whatsapp.md).
// Quem chama, pelo pg_net e com o cabeçalho x-whatsapp-secret: o gatilho queue_whatsapp_payment (pedido pago) e o
// agendador whatsapp_queue_followups (lembrete de pedido não pago e pós-venda).
//
// Modo teste (whatsapp_settings.mode = 'test', o padrão): nada sai para o cliente. Grava no registro o texto exato que
// sairia; no pagamento, também o acesso de cada conta, com as senhas mascaradas.
// Modo live: se o cliente falou com a loja nas últimas 24h, sai texto livre (no pagamento, o acesso direto). Senão vai
// o modelo aprovado na Meta; no pagamento, com o botão "Receber meu acesso" (o acesso sai no toque, whatsapp-webhook).
//
// Deploy: npx supabase functions deploy whatsapp-send --no-verify-jwt
// Segredos: WHATSAPP_SEND_SECRET (o mesmo valor de whatsapp_send_secret no Vault).
//           No modo live: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID e, opcional, WHATSAPP_API_VERSION.
//           SITE_URL (link do pedido no lembrete; padrão jotadigitais.com.br).
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.117.3";
import { deliverAccess, deliveryItems, deliveryTemplate, deliveryText, logDelivery, promptValuesOf, type DeliveryItem } from "../_shared/whatsapp-access.ts";
import { CloudSendError, insideWindow, sendCloudTemplate } from "../_shared/whatsapp-cloud.ts";
import {
  AFTER_SALE_TEMPLATE,
  PAYMENT_TEMPLATE,
  REMINDER_TEMPLATE,
  accessButtonPayload,
  afterSaleParams,
  afterSaleText,
  firstName,
  joinHandles,
  paymentPromptParams,
  paymentPromptText,
  phoneVariants,
  reminderParams,
  reminderText,
} from "../_shared/whatsapp-delivery.ts";
import { recordOutbound } from "../_shared/whatsapp-outbound.ts";

const DEFAULT_SITE_URL = "https://jotadigitais.com.br";
const STORE_TIME_ZONE = "America/Sao_Paulo";

interface QueuedMessage {
  id: string;
  order_id: string | null;
  kind: "payment_confirmed" | "delivery" | "payment_reminder" | "after_sale";
  to_phone: string;
}

interface OrderRow {
  code: string;
  cart_code: string | null;
  customer_name: string;
  account_handle: string;
  status: string;
  expires_at: string;
}

/** O que sai para o cliente: texto livre (janela aberta) ou o modelo aprovado. `cancel` explica por que não sai. */
type Prepared = { text: string; template: { name: string; language: string }; params: string[] } | { cancel: string };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** Comparação em tempo constante para o segredo do banco. */
function sameSecret(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
}

/** Marca a mensagem como "enviando" só se ainda estava na fila: chamada repetida não manda duas vezes. */
async function claim(admin: SupabaseClient, id: string): Promise<QueuedMessage | null> {
  const { data, error } = await admin
    .from("whatsapp_messages")
    .update({ status: "sending" })
    .eq("id", id)
    .eq("status", "queued")
    .select("id, order_id, kind, to_phone")
    .maybeSingle();
  if (error) throw error;
  return data as QueuedMessage | null;
}

async function settingsMode(admin: SupabaseClient): Promise<"test" | "live"> {
  const { data, error } = await admin.from("whatsapp_settings").select("mode").single();
  if (error) throw error;
  return data.mode === "live" ? "live" : "test";
}

/** Conversa do comprador com a janela de 24h aberta: aí a mensagem sai como texto livre, sem modelo. */
async function openConversation(admin: SupabaseClient, phone: string): Promise<{ id: string; phone: string; name: string | null } | null> {
  const { data, error } = await admin
    .from("whatsapp_contacts")
    .select("id, phone, name, last_inbound_at")
    .in("phone", phoneVariants(phone))
    .order("last_inbound_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data && insideWindow(data.last_inbound_at) ? data : null;
}

async function finish(admin: SupabaseClient, id: string, fields: Record<string, unknown>) {
  const { error } = await admin.from("whatsapp_messages").update(fields).eq("id", id);
  if (error) throw error;
}

const now = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// Pagamento confirmado: aviso com o botão e, depois do toque, o acesso
// ---------------------------------------------------------------------------

/** Modo teste: registra o aviso de pagamento e, logo abaixo, o acesso de cada conta como sairia após o toque. */
async function recordPaymentTest(admin: SupabaseClient, message: QueuedMessage, items: DeliveryItem[]) {
  await finish(admin, message.id, { status: "test", body: paymentPromptText(promptValuesOf(items)), sent_at: now() });
  const body = await deliveryTemplate(admin);
  await logDelivery(
    admin,
    items.map((item) => ({ orderId: item.order_id, phone: message.to_phone, body: deliveryText(body, item, true), status: "test", error: null, waMessageId: null })),
  );
}

async function processPayment(admin: SupabaseClient, message: QueuedMessage, orderId: string, mode: "test" | "live"): Promise<string> {
  const items = await deliveryItems(admin, orderId);
  if (items.length === 0) {
    await finish(admin, message.id, { status: "canceled", error: "Pedido não está mais pago." });
    return "canceled";
  }
  if (mode === "test") {
    await recordPaymentTest(admin, message, items);
    return "test";
  }

  const values = promptValuesOf(items);
  const conversation = await openConversation(admin, message.to_phone);
  if (conversation) {
    // O cliente falou com a loja nas últimas 24h: o acesso vai direto, com o texto editável, sem esperar o botão.
    await finish(admin, message.id, { status: "sent", body: `${paymentPromptText(values)} (janela aberta: acesso enviado direto)`, sent_at: now() });
    const outcome = await deliverAccess(admin, { contactId: conversation.id, phone: conversation.phone, name: conversation.name, code: values.orderCode, mode: "live" });
    return outcome === "delivered" ? "delivered" : "failed";
  }
  try {
    const waId = await sendCloudTemplate(message.to_phone, PAYMENT_TEMPLATE, paymentPromptParams(values), accessButtonPayload(values.orderCode));
    await finish(admin, message.id, { status: "sent", body: paymentPromptText(values), wa_message_id: waId, sent_at: now() });
    return "sent";
  } catch (error) {
    if (!(error instanceof CloudSendError)) throw error;
    await finish(admin, message.id, { status: "failed", body: paymentPromptText(values), error: error.message });
    return "failed";
  }
}

// ---------------------------------------------------------------------------
// Lembrete de pedido não pago e pós-venda
// ---------------------------------------------------------------------------

const ORDER_COLUMNS = "code, cart_code, customer_name, account_handle, status, expires_at";

/** O pedido e os outros do mesmo carrinho, o principal primeiro. */
async function cartOf(admin: SupabaseClient, orderId: string): Promise<OrderRow[]> {
  const { data: order, error } = await admin.from("orders").select(ORDER_COLUMNS).eq("id", orderId).maybeSingle();
  if (error) throw error;
  if (!order) return [];
  if (!order.cart_code) return [order as OrderRow];
  const { data, error: cartError } = await admin.from("orders").select(ORDER_COLUMNS).eq("cart_code", order.cart_code).order("code");
  if (cartError) throw cartError;
  const rows = data as OrderRow[];
  return [...rows.filter((row) => row.code === row.cart_code), ...rows.filter((row) => row.code !== row.cart_code)];
}

const timeOf = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: STORE_TIME_ZONE }).format(new Date(iso));

const siteUrl = () => (Deno.env.get("SITE_URL") ?? DEFAULT_SITE_URL).replace(/\/$/, "");

function prepareReminder(rows: readonly OrderRow[]): Prepared {
  const main = rows[0];
  if (!main || main.status !== "awaiting_payment" || new Date(main.expires_at).getTime() <= Date.now()) {
    return { cancel: "Pedido já pago, cancelado ou vencido: o lembrete não saiu." };
  }
  const code = main.cart_code ?? main.code;
  const values = {
    name: firstName(main.customer_name),
    orderCode: code,
    accounts: joinHandles(rows.map((row) => row.account_handle)),
    until: timeOf(main.expires_at),
    link: `${siteUrl()}/pedido/${code}`,
  };
  return { text: reminderText(values), template: REMINDER_TEMPLATE, params: reminderParams(values) };
}

function prepareAfterSale(rows: readonly OrderRow[]): Prepared {
  const main = rows[0];
  if (!main || main.status !== "delivered") return { cancel: "Pedido não está entregue: o pós-venda não saiu." };
  const delivered = rows.filter((row) => row.status === "delivered").map((row) => row.account_handle);
  const values = { name: firstName(main.customer_name), accounts: joinHandles(delivered) };
  return { text: afterSaleText(values), template: AFTER_SALE_TEMPLATE, params: afterSaleParams(values) };
}

async function processFollowUp(admin: SupabaseClient, message: QueuedMessage, orderId: string, mode: "test" | "live"): Promise<string> {
  const rows = await cartOf(admin, orderId);
  const prepared = message.kind === "payment_reminder" ? prepareReminder(rows) : prepareAfterSale(rows);
  if ("cancel" in prepared) {
    await finish(admin, message.id, { status: "canceled", error: prepared.cancel });
    return "canceled";
  }
  if (mode === "test") {
    await finish(admin, message.id, { status: "test", body: prepared.text, sent_at: now() });
    return "test";
  }

  const conversation = await openConversation(admin, message.to_phone);
  if (conversation) {
    // Janela aberta: texto livre (sem custo de modelo) e a mensagem fica na conversa, para a IA saber do que se trata.
    const result = await recordOutbound(admin, conversation.id, conversation.phone, "system", prepared.text, "live");
    await finish(admin, message.id, { status: result.status, body: prepared.text, error: result.error, wa_message_id: result.waMessageId, sent_at: now() });
    return result.status;
  }
  try {
    const waId = await sendCloudTemplate(message.to_phone, prepared.template, prepared.params);
    await finish(admin, message.id, { status: "sent", body: prepared.text, wa_message_id: waId, sent_at: now() });
    return "sent";
  } catch (error) {
    if (!(error instanceof CloudSendError)) throw error;
    await finish(admin, message.id, { status: "failed", body: prepared.text, error: error.message });
    return "failed";
  }
}

async function process(admin: SupabaseClient, messageId: string): Promise<string> {
  const message = await claim(admin, messageId);
  if (!message) return "already_handled";
  if (message.kind === "delivery" || !message.order_id) {
    await finish(admin, message.id, { status: "failed", error: "Tipo de mensagem sem envio pela fila." });
    return "failed";
  }
  const mode = await settingsMode(admin);
  return message.kind === "payment_confirmed"
    ? processPayment(admin, message, message.order_id, mode)
    : processFollowUp(admin, message, message.order_id, mode);
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "method" }, 405);
  const expected = Deno.env.get("WHATSAPP_SEND_SECRET");
  const given = request.headers.get("x-whatsapp-secret");
  if (!expected || !given || !sameSecret(given, expected)) return json({ error: "forbidden" }, 403);

  const body = (await request.json().catch(() => null)) as { message_id?: unknown } | null;
  const messageId = typeof body?.message_id === "string" ? body.message_id : null;
  if (!messageId || !/^[0-9a-f-]{36}$/i.test(messageId)) return json({ error: "invalid" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  try {
    return json({ result: await process(admin, messageId) });
  } catch (error) {
    console.error("whatsapp-send", messageId, error);
    await finish(admin, messageId, { status: "failed", error: "Erro interno ao preparar a mensagem." }).catch(() => undefined);
    return json({ error: "server" }, 500);
  }
});
