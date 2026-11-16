// Entrega automática pelo WhatsApp (docs/whatsapp.md).
// Quem chama: o gatilho queue_whatsapp_payment (pedido pago), pelo pg_net, com o cabeçalho x-whatsapp-secret.
//
// Modo teste (whatsapp_settings.mode = 'test', o padrão): nada sai para o cliente. Grava no registro a mensagem do
// modelo "Pagamento confirmado" e, para cada conta, a mensagem "Conta entregue" que sairia depois do toque no botão,
// com as senhas mascaradas.
// Modo live: envia o modelo aprovado pela Cloud API da Meta. O acesso sai quando o cliente toca no botão
// (função whatsapp-webhook, fase 2).
//
// Deploy: npx supabase functions deploy whatsapp-send --no-verify-jwt
// Segredos: WHATSAPP_SEND_SECRET (o mesmo valor de whatsapp_send_secret no Vault).
//           No modo live: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID e, opcional, WHATSAPP_API_VERSION.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.117.3";
import { DEFAULT_MESSAGE_TEMPLATES, fillDeliveryTemplate, type DeliveryLoginValues } from "../_shared/message-template.ts";
import {
  MASKED_SECRET,
  PAYMENT_TEMPLATE,
  accessButtonPayload,
  firstName,
  joinHandles,
  paymentPromptParams,
  paymentPromptText,
  type PaymentPromptValues,
} from "../_shared/whatsapp-delivery.ts";

const STORE_NAME = "Jota Digitais";
const DEFAULT_API_VERSION = "v24.0";

const PLATFORM_LABEL: Record<string, string> = { tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube", facebook: "Facebook" };

interface QueuedMessage {
  id: string;
  order_id: string | null;
  kind: "payment_confirmed" | "delivery";
  to_phone: string;
}

interface DeliveryItem {
  order_id: string;
  code: string;
  cart_code: string | null;
  customer_name: string;
  account_handle: string;
  account_platform: string;
  total_cents: number;
  email: string | null;
  email_password: string | null;
  profile_username: string | null;
  profile_password: string | null;
}

class SendError extends Error {}

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

const formatBRL = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

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

async function deliveryItems(admin: SupabaseClient, orderId: string): Promise<DeliveryItem[]> {
  const { data, error } = await admin.rpc("whatsapp_delivery_items", { p_order_id: orderId });
  if (error) throw error;
  return data as DeliveryItem[];
}

async function deliveryTemplate(admin: SupabaseClient): Promise<string> {
  const { data, error } = await admin.from("message_templates").select("body").eq("key", "order_delivered").maybeSingle();
  if (error) throw error;
  return data?.body ?? DEFAULT_MESSAGE_TEMPLATES.order_delivered;
}

function promptValuesOf(items: DeliveryItem[]): PaymentPromptValues {
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
function deliveryText(body: string, item: DeliveryItem, masked: boolean): string {
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

async function sendTemplate(to: string, values: PaymentPromptValues): Promise<string> {
  const token = Deno.env.get("WHATSAPP_TOKEN");
  const phoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  if (!token || !phoneId) throw new SendError("WhatsApp não conectado: faltam WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID.");
  const version = Deno.env.get("WHATSAPP_API_VERSION") ?? DEFAULT_API_VERSION;
  const response = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: PAYMENT_TEMPLATE.name,
        language: { code: PAYMENT_TEMPLATE.language },
        components: [
          { type: "body", parameters: paymentPromptParams(values).map((text) => ({ type: "text", text })) },
          { type: "button", sub_type: "quick_reply", index: "0", parameters: [{ type: "payload", payload: accessButtonPayload(values.orderCode) }] },
        ],
      },
    }),
  });
  const result = (await response.json().catch(() => null)) as { messages?: { id: string }[]; error?: { message?: string } } | null;
  if (!response.ok || !result?.messages?.[0]?.id) {
    throw new SendError(`Meta recusou (${response.status}): ${result?.error?.message ?? "sem detalhe"}`.slice(0, 1000));
  }
  return result.messages[0].id;
}

async function finish(admin: SupabaseClient, id: string, fields: Record<string, unknown>) {
  const { error } = await admin.from("whatsapp_messages").update(fields).eq("id", id);
  if (error) throw error;
}

/** Modo teste: registra o aviso de pagamento e, logo abaixo, o acesso de cada conta como sairia após o toque. */
async function recordTest(admin: SupabaseClient, message: QueuedMessage, items: DeliveryItem[]) {
  const now = new Date().toISOString();
  await finish(admin, message.id, { status: "test", body: paymentPromptText(promptValuesOf(items)), sent_at: now });
  const body = await deliveryTemplate(admin);
  const rows = items.map((item) => ({
    order_id: item.order_id,
    kind: "delivery",
    to_phone: message.to_phone,
    body: deliveryText(body, item, true),
    status: "test",
    sent_at: now,
  }));
  const { error } = await admin.from("whatsapp_messages").insert(rows);
  if (error) throw error;
}

async function process(admin: SupabaseClient, messageId: string): Promise<string> {
  const message = await claim(admin, messageId);
  if (!message) return "already_handled";
  if (message.kind !== "payment_confirmed" || !message.order_id) {
    await finish(admin, message.id, { status: "failed", error: "Tipo de mensagem sem envio automático nesta fase." });
    return "failed";
  }
  const items = await deliveryItems(admin, message.order_id);
  if (items.length === 0) {
    await finish(admin, message.id, { status: "failed", error: "Pedido não está mais pago." });
    return "failed";
  }

  if ((await settingsMode(admin)) === "test") {
    await recordTest(admin, message, items);
    return "test";
  }

  const values = promptValuesOf(items);
  try {
    const waId = await sendTemplate(message.to_phone, values);
    await finish(admin, message.id, { status: "sent", body: paymentPromptText(values), wa_message_id: waId, sent_at: new Date().toISOString() });
    return "sent";
  } catch (error) {
    if (!(error instanceof SendError)) throw error;
    await finish(admin, message.id, { status: "failed", body: paymentPromptText(values), error: error.message });
    return "failed";
  }
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
