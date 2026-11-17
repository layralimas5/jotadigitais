// Recebe as mensagens do WhatsApp oficial (Meta Cloud API) e responde pela IA (docs/whatsapp.md).
// GET: verificação do webhook no painel da Meta (hub.verify_token).
// POST: eventos. Confere a assinatura X-Hub-Signature-256 com o segredo do app e sempre devolve 200 depois de
// processar: a Meta reenvia o que não recebe 200, e o wa_message_id único evita responder duas vezes.
//
// Deploy: npx supabase functions deploy whatsapp-webhook --no-verify-jwt
// Segredos: WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET, WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, ANTHROPIC_API_KEY.
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { processInbound, type InboundMessage } from "../_shared/whatsapp-inbound.ts";

interface MetaMessage {
  from: string;
  id: string;
  type: string;
  text?: { body?: string };
  button?: { text?: string; payload?: string };
  interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
}

interface MetaChangeValue {
  contacts?: { wa_id: string; profile?: { name?: string } }[];
  messages?: MetaMessage[];
}

interface MetaPayload {
  entry?: { changes?: { field?: string; value?: MetaChangeValue }[] }[];
}

const MEDIA_LABEL: Record<string, string> = {
  audio: "[áudio]",
  image: "[foto]",
  video: "[vídeo]",
  document: "[arquivo]",
  sticker: "[figurinha]",
  location: "[localização]",
  contacts: "[contato]",
};

async function validSignature(rawBody: string, header: string | null, secret: string): Promise<boolean> {
  if (!header?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)));
  const expected = [...signature].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const given = header.slice("sha256=".length);
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

function bodyOf(message: MetaMessage): string {
  if (message.type === "text") return message.text?.body?.trim() || "[mensagem vazia]";
  if (message.type === "button") return message.button?.text?.trim() || "[botão]";
  if (message.type === "interactive") {
    return message.interactive?.button_reply?.title?.trim() || message.interactive?.list_reply?.title?.trim() || "[botão]";
  }
  return MEDIA_LABEL[message.type] ?? `[${message.type}]`;
}

function inboundMessages(payload: MetaPayload): InboundMessage[] {
  const result: InboundMessage[] = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages" || !change.value?.messages) continue;
      const names = new Map((change.value.contacts ?? []).map((contact) => [contact.wa_id, contact.profile?.name ?? null]));
      for (const message of change.value.messages) {
        if (!/^\d{10,15}$/.test(message.from)) continue;
        result.push({ phone: message.from, name: names.get(message.from) ?? null, body: bodyOf(message), waMessageId: message.id });
      }
    }
  }
  return result;
}

Deno.serve(async (request) => {
  const url = new URL(request.url);

  if (request.method === "GET") {
    const expected = Deno.env.get("WHATSAPP_VERIFY_TOKEN");
    const ok = expected && url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === expected;
    return ok ? new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 }) : new Response("forbidden", { status: 403 });
  }
  if (request.method !== "POST") return new Response("method", { status: 405 });

  const secret = Deno.env.get("WHATSAPP_APP_SECRET");
  const rawBody = await request.text();
  if (!secret || !(await validSignature(rawBody, request.headers.get("x-hub-signature-256"), secret))) {
    return new Response("forbidden", { status: 403 });
  }

  let payload: MetaPayload;
  try {
    payload = JSON.parse(rawBody) as MetaPayload;
  } catch {
    return new Response("invalid", { status: 400 });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  // Uma por vez e na ordem: mensagens seguidas do mesmo cliente entram no histórico antes da próxima resposta.
  for (const message of inboundMessages(payload)) {
    try {
      await processInbound(admin, message);
    } catch (error) {
      console.error("whatsapp-webhook", message.waMessageId, error);
    }
  }
  return new Response("ok", { status: 200 });
});
