// Entrega automática pelo WhatsApp (docs/whatsapp.md).
// Quem chama: o gatilho queue_whatsapp_payment (pedido pago), pelo pg_net, com o cabeçalho x-whatsapp-secret.
//
// Modo teste (whatsapp_settings.mode = 'test', o padrão): nada sai para o cliente. Grava no registro a mensagem do
// modelo "Pagamento confirmado" e, para cada conta, a mensagem "Conta entregue" que sairia depois do toque no botão,
// com as senhas mascaradas.
// Modo live: se o cliente falou com a loja nas últimas 24h, o acesso sai direto. Senão vai o modelo aprovado com o
// botão "Receber meu acesso", e o acesso sai quando ele toca (whatsapp-webhook).
//
// Deploy: npx supabase functions deploy whatsapp-send --no-verify-jwt
// Segredos: WHATSAPP_SEND_SECRET (o mesmo valor de whatsapp_send_secret no Vault).
//           No modo live: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID e, opcional, WHATSAPP_API_VERSION.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.117.3";
import { deliverAccess, deliveryItems, deliveryTemplate, deliveryText, logDelivery, promptValuesOf, type DeliveryItem } from "../_shared/whatsapp-access.ts";
import { insideWindow } from "../_shared/whatsapp-cloud.ts";
import {
  PAYMENT_TEMPLATE,
  accessButtonPayload,
  paymentPromptParams,
  paymentPromptText,
  phoneVariants,
  type PaymentPromptValues,
} from "../_shared/whatsapp-delivery.ts";

const DEFAULT_API_VERSION = "v24.0";

interface QueuedMessage {
  id: string;
  order_id: string | null;
  kind: "payment_confirmed" | "delivery";
  to_phone: string;
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

/** Conversa do comprador com a janela de 24h aberta: aí o acesso pode sair direto, sem o modelo e sem o toque. */
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
  await finish(admin, message.id, { status: "test", body: paymentPromptText(promptValuesOf(items)), sent_at: new Date().toISOString() });
  const body = await deliveryTemplate(admin);
  await logDelivery(
    admin,
    items.map((item) => ({ orderId: item.order_id, phone: message.to_phone, body: deliveryText(body, item, true), status: "test", error: null, waMessageId: null })),
  );
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
  const conversation = await openConversation(admin, message.to_phone);
  if (conversation) {
    // O cliente falou com a loja nas últimas 24h: o acesso vai direto, com o texto editável, sem esperar o botão.
    await finish(admin, message.id, { status: "sent", body: `${paymentPromptText(values)} (janela aberta: acesso enviado direto)`, sent_at: new Date().toISOString() });
    const outcome = await deliverAccess(admin, { contactId: conversation.id, phone: conversation.phone, name: conversation.name, code: values.orderCode, mode: "live" });
    return outcome === "delivered" ? "delivered" : "failed";
  }
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
