// O que acontece com cada mensagem do cliente: registra, decide se a IA responde, responde (ou só registra, no modo
// teste), seguindo o roteiro dos fluxos desenhados em WhatsApp > Fluxos, e chama o Jota quando precisa. Pedido de acesso
// (botão do modelo ou código do pedido) entrega o login antes de tudo. Usado pela whatsapp-webhook (Meta) e pelo
// "Simular cliente" do painel.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.117.3";
import { deliverAccess } from "./whatsapp-access.ts";
import { accessCodeOf } from "./whatsapp-delivery.ts";
import { conversationLink, handOff, notify as notifyJota, recordOutbound } from "./whatsapp-outbound.ts";
import { loadAiConfig, runAssistant, type ChatTurn } from "./whatsapp-ai.ts";
import { aiAnswersAt, isBusinessHours, isOptIn, isOptOut, type AiSchedule } from "./whatsapp-schedule.ts";

export interface InboundMessage {
  /** Só dígitos, com DDI (formato da Meta). */
  phone: string;
  name: string | null;
  body: string;
  waMessageId: string | null;
  /** Payload do botão de resposta rápida do modelo (ex.: `acesso:JD-ABC123`). */
  buttonPayload?: string | null;
}

interface Settings {
  mode: "test" | "live";
  auto_delivery: boolean;
  ai_enabled: boolean;
  ai_schedule: AiSchedule;
  business_start: string;
  business_end: string;
  business_days: number[];
  ignored_numbers: string[];
}

interface Registered {
  contact_id: string;
  is_new: boolean;
  duplicate: boolean;
  handler: "ai" | "staff";
  opted_out: boolean;
  unread_count: number;
}

export type InboundOutcome =
  | "duplicate"
  | "ignored"
  | "opted_out"
  | "staff"
  | "ai_off"
  | "replied"
  | "handoff"
  | "access_delivered"
  | "access_wrong_phone"
  | "access_failed";

const ACCESS_OUTCOME = { delivered: "access_delivered", wrong_phone: "access_wrong_phone", failed: "access_failed" } as const;

const notify = (admin: SupabaseClient, contactId: string, title: string, body: string) => notifyJota(admin, conversationLink(contactId), title, body);

const KIND_LABEL: Record<string, string> = { lead: "interessado (ainda não comprou)", customer: "cliente (já comprou)", affiliate: "afiliado", student: "aluno" };

const OPT_OUT_REPLY = "Pronto, não vou mais mandar mensagens automáticas. Se quiser voltar, é só escrever *voltar*.";
const OPT_IN_REPLY = "Combinado, o atendimento automático voltou. Como posso te ajudar?";
const FAILURE_SUMMARY = "A IA não conseguiu responder esta mensagem. Responda pelo painel.";

async function settingsOf(admin: SupabaseClient): Promise<Settings> {
  const { data, error } = await admin
    .from("whatsapp_settings")
    .select("mode, auto_delivery, ai_enabled, ai_schedule, business_start, business_end, business_days, ignored_numbers")
    .single();
  if (error) throw error;
  return data as Settings;
}

async function historyOf(admin: SupabaseClient, contactId: string): Promise<ChatTurn[]> {
  const { data, error } = await admin
    .from("whatsapp_chat")
    .select("author, body")
    .eq("contact_id", contactId)
    .neq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data as { author: string; body: string }[])
    .reverse()
    .map((row) => ({ role: row.author === "customer" ? "user" : "assistant", text: row.body }));
}

export async function processInbound(admin: SupabaseClient, message: InboundMessage, forceMode?: "test"): Promise<InboundOutcome> {
  const settings = await settingsOf(admin);
  const mode = forceMode ?? settings.mode;
  const { data, error } = await admin.rpc("whatsapp_register_inbound", {
    p_phone: message.phone,
    p_name: message.name,
    p_body: message.body,
    p_wa_message_id: message.waMessageId,
  });
  if (error) throw error;
  const contact = (data as Registered[])[0]!;
  if (contact.duplicate) return "duplicate";

  if (settings.ignored_numbers.includes(message.phone)) return "ignored";

  // Pedido de acesso vale mesmo com a IA desligada ou a conversa com o Jota: é a entrega automática, não a IA.
  const accessCode = settings.auto_delivery ? accessCodeOf(message.body, message.buttonPayload) : null;
  if (accessCode) {
    const access = await deliverAccess(admin, { contactId: contact.contact_id, phone: message.phone, name: message.name, code: accessCode, mode });
    if (access !== "not_ready") return ACCESS_OUTCOME[access];
  }

  if (isOptOut(message.body)) {
    if (!contact.opted_out) {
      await admin.from("whatsapp_contacts").update({ opted_out: true }).eq("id", contact.contact_id);
      await recordOutbound(admin, contact.contact_id, message.phone, "system", OPT_OUT_REPLY, mode);
    }
    return "opted_out";
  }
  if (contact.opted_out) {
    if (!isOptIn(message.body)) return "opted_out";
    await admin.from("whatsapp_contacts").update({ opted_out: false }).eq("id", contact.contact_id);
    await recordOutbound(admin, contact.contact_id, message.phone, "system", OPT_IN_REPLY, mode);
    return "replied";
  }

  if (contact.handler === "staff") {
    // Avisa só na primeira mensagem sem resposta: o cliente mandando várias seguidas não vira uma enxurrada.
    if (contact.unread_count === 1) await notify(admin, contact.contact_id, `${message.name ?? "Cliente"} mandou mensagem`, message.body);
    return "staff";
  }

  const hours = { schedule: settings.ai_schedule, start: settings.business_start, end: settings.business_end, days: settings.business_days };
  if (!settings.ai_enabled || !aiAnswersAt(hours, new Date())) {
    if (contact.unread_count === 1) await notify(admin, contact.contact_id, `${message.name ?? "Cliente"} mandou mensagem`, message.body);
    return "ai_off";
  }

  try {
    const { data: profile, error: profileError } = await admin.from("whatsapp_contacts").select("kind").eq("id", contact.contact_id).single();
    if (profileError) throw profileError;
    const result = await runAssistant(admin, {
      config: await loadAiConfig(admin),
      history: await historyOf(admin, contact.contact_id),
      phone: message.phone,
      firstContact: contact.is_new,
      context: { kindLabel: KIND_LABEL[profile.kind] ?? profile.kind, businessHours: isBusinessHours(hours, new Date()) },
    });
    if (result.reply) await recordOutbound(admin, contact.contact_id, message.phone, "ai", result.reply, mode, { options: result.options });
    if (result.handoff) {
      await handOff(admin, contact.contact_id, message.name, `${result.handoff.reason}. ${result.handoff.summary}`);
      return "handoff";
    }
    if (!result.reply) {
      await handOff(admin, contact.contact_id, message.name, FAILURE_SUMMARY);
      return "handoff";
    }
    return "replied";
  } catch (reason) {
    console.error("whatsapp ai", contact.contact_id, reason);
    await handOff(admin, contact.contact_id, message.name, FAILURE_SUMMARY);
    return "handoff";
  }
}
