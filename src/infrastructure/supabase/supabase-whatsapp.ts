import { FunctionsHttpError, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { AdminWhatsAppRepository } from "@/application/ports";
import { WhatsAppAiUnavailableError, WhatsAppWindowClosedError } from "@/domain/errors";
import {
  CONTACT_KINDS,
  type AiDraft,
  type FlowTestDraft,
  type InboundOutcome,
  type SimulatorReply,
  type SimulatorTurn,
  type WhatsAppAiSettings,
  type WhatsAppChatMessage,
  type WhatsAppContact,
  type WhatsAppContactKind,
  type WhatsAppFaq,
  type WhatsAppFaqDraft,
  type WhatsAppHandler,
  type WhatsAppMessage,
  type WhatsAppFollowUps,
  type WhatsAppSettings,
} from "@/domain/whatsapp";
import { parseFlowGraph, type WhatsAppFlow, type WhatsAppFlowDraft } from "@/domain/whatsapp-flow";
import { fail } from "./supabase-repositories";

const PANEL_FUNCTION = "whatsapp-panel";

const SETTINGS_COLUMNS = "auto_delivery, mode, payment_reminder, reminder_minutes, after_sale, after_sale_days";

const settingsRowSchema = z.object({
  auto_delivery: z.boolean(),
  mode: z.enum(["test", "live"]),
  payment_reminder: z.boolean(),
  reminder_minutes: z.number().int(),
  after_sale: z.boolean(),
  after_sale_days: z.number().int(),
});

const toSettings = (raw: unknown): WhatsAppSettings => {
  const row = settingsRowSchema.parse(raw);
  return {
    autoDelivery: row.auto_delivery,
    mode: row.mode,
    followUps: {
      paymentReminder: row.payment_reminder,
      reminderMinutes: row.reminder_minutes,
      afterSale: row.after_sale,
      afterSaleDays: row.after_sale_days,
    },
  };
};

const MESSAGE_COLUMNS = "id, kind, status, to_phone, body, error, created_at, sent_at, order:orders(code, customer_name)";

const messageRowSchema = z.object({
  id: z.string(),
  kind: z.enum(["payment_confirmed", "delivery", "payment_reminder", "after_sale"]),
  status: z.enum(["queued", "sending", "test", "sent", "failed", "canceled"]),
  to_phone: z.string(),
  body: z.string().nullable(),
  error: z.string().nullable(),
  created_at: z.string(),
  sent_at: z.string().nullable(),
  order: z.object({ code: z.string(), customer_name: z.string() }).nullable(),
});

function toMessage(raw: unknown): WhatsAppMessage {
  const row = messageRowSchema.parse(raw);
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    toPhone: row.to_phone,
    body: row.body,
    error: row.error,
    orderCode: row.order?.code ?? null,
    customerName: row.order?.customer_name ?? null,
    createdAt: row.created_at,
    sentAt: row.sent_at,
  };
}

const AI_COLUMNS =
  "ai_enabled, ai_greeting, ai_tone, ai_instructions, ai_schedule, business_start, business_end, business_days, ignored_numbers";

const aiRowSchema = z.object({
  ai_enabled: z.boolean(),
  ai_greeting: z.string(),
  ai_tone: z.string(),
  ai_instructions: z.string(),
  ai_schedule: z.enum(["always", "off_hours"]),
  business_start: z.string(),
  business_end: z.string(),
  business_days: z.array(z.number().int()),
  ignored_numbers: z.array(z.string()),
});

function toAiSettings(raw: unknown): WhatsAppAiSettings {
  const row = aiRowSchema.parse(raw);
  return {
    enabled: row.ai_enabled,
    greeting: row.ai_greeting,
    tone: row.ai_tone,
    instructions: row.ai_instructions,
    schedule: row.ai_schedule,
    // O Postgres devolve "09:00:00".
    businessStart: row.business_start.slice(0, 5),
    businessEnd: row.business_end.slice(0, 5),
    businessDays: [...row.business_days].sort(),
    ignoredNumbers: row.ignored_numbers,
  };
}

const faqRowSchema = z.object({ id: z.string(), question: z.string(), answer: z.string() });

const CONTACT_COLUMNS =
  "id, phone, name, kind, handler, opted_out, handoff_summary, unread_count, last_inbound_at, last_message_at, last_message_preview";

const contactRowSchema = z.object({
  id: z.string(),
  phone: z.string(),
  name: z.string().nullable(),
  kind: z.enum(CONTACT_KINDS),
  handler: z.enum(["ai", "staff"]),
  opted_out: z.boolean(),
  handoff_summary: z.string().nullable(),
  unread_count: z.number().int(),
  last_inbound_at: z.string().nullable(),
  last_message_at: z.string(),
  last_message_preview: z.string().nullable(),
});

function toContact(raw: unknown): WhatsAppContact {
  const row = contactRowSchema.parse(raw);
  return {
    id: row.id,
    phone: row.phone,
    name: row.name,
    kind: row.kind,
    handler: row.handler,
    optedOut: row.opted_out,
    handoffSummary: row.handoff_summary,
    unreadCount: row.unread_count,
    lastInboundAt: row.last_inbound_at,
    lastMessageAt: row.last_message_at,
    lastMessagePreview: row.last_message_preview,
  };
}

const chatRowSchema = z.object({
  id: z.string(),
  author: z.enum(["customer", "ai", "staff", "system"]),
  body: z.string(),
  status: z.enum(["received", "test", "sent", "failed"]),
  error: z.string().nullable(),
  created_at: z.string(),
});

function toChat(raw: unknown): WhatsAppChatMessage {
  const row = chatRowSchema.parse(raw);
  return { id: row.id, author: row.author, body: row.body, status: row.status, error: row.error, createdAt: row.created_at };
}

const simulatorSchema = z.object({
  reply: z.string().nullable(),
  handoff: z.object({ reason: z.string(), summary: z.string() }).nullable(),
  toolsUsed: z.array(z.string()),
  options: z.array(z.string()).default([]),
});

const FLOW_COLUMNS = "id, name, enabled, graph, updated_at";

const flowRowSchema = z.object({ id: z.string(), name: z.string(), enabled: z.boolean(), graph: z.unknown(), updated_at: z.string() });

const toFlow = (raw: unknown): WhatsAppFlow => {
  const row = flowRowSchema.parse(raw);
  return { id: row.id, name: row.name, enabled: row.enabled, graph: parseFlowGraph(row.graph), updatedAt: row.updated_at };
};

const inboundSchema = z.object({
  contactId: z.string(),
  outcome: z.enum(["duplicate", "ignored", "opted_out", "staff", "ai_off", "replied", "handoff"]),
});

const PANEL_ERROR_MESSAGE: Record<string, string> = {
  forbidden: "Só quem tem acesso ao WhatsApp e automação pode usar o WhatsApp do painel.",
  invalid: "Dados inválidos. Confira os textos e tente de novo.",
  not_found: "Essa conversa não existe mais. Atualize a lista.",
  not_test: "Simular cliente só funciona no modo teste.",
};

async function failFromPanel(error: unknown): Promise<never> {
  console.error(error);
  if (error instanceof FunctionsHttpError) {
    const body = (await error.context.json().catch(() => null)) as { error?: unknown } | null;
    const code = typeof body?.error === "string" ? body.error : "";
    if (code === "window_closed") throw new WhatsAppWindowClosedError();
    if (code === "ai_unavailable") throw new WhatsAppAiUnavailableError();
    const message = PANEL_ERROR_MESSAGE[code];
    if (message) throw new Error(message);
  }
  throw new Error("Não foi possível falar com o servidor. Tente de novo em instantes.");
}

export class SupabaseWhatsAppRepository implements AdminWhatsAppRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getSettings(): Promise<WhatsAppSettings> {
    const { data, error } = await this.client.from("whatsapp_settings").select(SETTINGS_COLUMNS).single();
    if (error) fail(error);
    return toSettings(data);
  }

  async setAutoDelivery(enabled: boolean): Promise<WhatsAppSettings> {
    const { data, error } = await this.client
      .from("whatsapp_settings")
      .update({ auto_delivery: enabled })
      .eq("id", true)
      .select(SETTINGS_COLUMNS)
      .single();
    if (error) fail(error);
    return toSettings(data);
  }

  async saveFollowUps(followUps: WhatsAppFollowUps): Promise<WhatsAppSettings> {
    const { data, error } = await this.client
      .from("whatsapp_settings")
      .update({
        payment_reminder: followUps.paymentReminder,
        reminder_minutes: followUps.reminderMinutes,
        after_sale: followUps.afterSale,
        after_sale_days: followUps.afterSaleDays,
      })
      .eq("id", true)
      .select(SETTINGS_COLUMNS)
      .single();
    if (error) fail(error);
    return toSettings(data);
  }

  async listMessages(limit: number): Promise<WhatsAppMessage[]> {
    const { data, error } = await this.client
      .from("whatsapp_messages")
      .select(MESSAGE_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) fail(error);
    return data.map(toMessage);
  }

  async getAiSettings(): Promise<WhatsAppAiSettings> {
    const { data, error } = await this.client.from("whatsapp_settings").select(AI_COLUMNS).single();
    if (error) fail(error);
    return toAiSettings(data);
  }

  async saveAiSettings(settings: WhatsAppAiSettings): Promise<WhatsAppAiSettings> {
    const { data, error } = await this.client
      .from("whatsapp_settings")
      .update({
        ai_enabled: settings.enabled,
        ai_greeting: settings.greeting,
        ai_tone: settings.tone,
        ai_instructions: settings.instructions,
        ai_schedule: settings.schedule,
        business_start: settings.businessStart,
        business_end: settings.businessEnd,
        business_days: settings.businessDays,
        ignored_numbers: settings.ignoredNumbers,
      })
      .eq("id", true)
      .select(AI_COLUMNS)
      .single();
    if (error) fail(error);
    return toAiSettings(data);
  }

  async setAiEnabled(enabled: boolean): Promise<WhatsAppAiSettings> {
    const { data, error } = await this.client.from("whatsapp_settings").update({ ai_enabled: enabled }).eq("id", true).select(AI_COLUMNS).single();
    if (error) fail(error);
    return toAiSettings(data);
  }

  async listFaq(): Promise<WhatsAppFaq[]> {
    const { data, error } = await this.client.from("whatsapp_faq").select("id, question, answer").order("position").order("created_at");
    if (error) fail(error);
    return data.map((row) => faqRowSchema.parse(row));
  }

  async saveFaq(items: readonly WhatsAppFaqDraft[]): Promise<WhatsAppFaq[]> {
    const current = await this.listFaq();
    const keep = new Set(items.flatMap((item) => (item.id ? [item.id] : [])));
    const removed = current.filter((item) => !keep.has(item.id)).map((item) => item.id);
    if (removed.length) {
      const { error } = await this.client.from("whatsapp_faq").delete().in("id", removed);
      if (error) fail(error);
    }
    const rows = items.map((item, index) => ({
      ...(item.id ? { id: item.id } : {}),
      question: item.question,
      answer: item.answer,
      position: index + 1,
    }));
    const existing = rows.filter((row) => "id" in row);
    const fresh = rows.filter((row) => !("id" in row));
    if (existing.length) {
      const { error } = await this.client.from("whatsapp_faq").upsert(existing);
      if (error) fail(error);
    }
    if (fresh.length) {
      const { error } = await this.client.from("whatsapp_faq").insert(fresh);
      if (error) fail(error);
    }
    return this.listFaq();
  }

  async simulate(history: readonly SimulatorTurn[], draft: AiDraft | null, flowTest?: FlowTestDraft): Promise<SimulatorReply> {
    const body = { action: "simulate", history, draft: draft ?? undefined, ...(flowTest ?? {}) };
    const { data, error } = await this.client.functions.invoke(PANEL_FUNCTION, { body });
    if (error) await failFromPanel(error);
    return simulatorSchema.parse(data);
  }

  async listContacts(): Promise<WhatsAppContact[]> {
    const { data, error } = await this.client.from("whatsapp_contacts").select(CONTACT_COLUMNS).order("last_message_at", { ascending: false }).limit(200);
    if (error) fail(error);
    return data.map(toContact);
  }

  async listChat(contactId: string): Promise<WhatsAppChatMessage[]> {
    const { data, error } = await this.client
      .from("whatsapp_chat")
      .select("id, author, body, status, error, created_at")
      .eq("contact_id", contactId)
      .order("created_at")
      .limit(500);
    if (error) fail(error);
    return data.map(toChat);
  }

  async setHandler(contactId: string, handler: WhatsAppHandler): Promise<void> {
    // Devolver para a IA limpa o resumo da passagem: ele era só para o Jota entender a conversa.
    const changes = handler === "ai" ? { handler, handoff_summary: null, unread_count: 0 } : { handler };
    const { error } = await this.client.from("whatsapp_contacts").update(changes).eq("id", contactId);
    if (error) fail(error);
  }

  async setContactKind(contactId: string, kind: WhatsAppContactKind): Promise<void> {
    const { error } = await this.client.from("whatsapp_contacts").update({ kind }).eq("id", contactId);
    if (error) fail(error);
  }

  async markRead(contactId: string): Promise<void> {
    const { error } = await this.client.from("whatsapp_contacts").update({ unread_count: 0 }).eq("id", contactId).gt("unread_count", 0);
    if (error) fail(error);
  }

  async sendReply(contactId: string, text: string): Promise<void> {
    const { error } = await this.client.functions.invoke(PANEL_FUNCTION, { body: { action: "reply", contactId, text } });
    if (error) await failFromPanel(error);
  }

  async simulateInbound(phone: string, name: string | null, text: string): Promise<{ contactId: string; outcome: InboundOutcome }> {
    const { data, error } = await this.client.functions.invoke(PANEL_FUNCTION, { body: { action: "simulate_inbound", phone, name, text } });
    if (error) await failFromPanel(error);
    return inboundSchema.parse(data);
  }

  async listFlows(): Promise<WhatsAppFlow[]> {
    const { data, error } = await this.client.from("whatsapp_flows").select(FLOW_COLUMNS).order("position").order("created_at");
    if (error) fail(error);
    return data.map(toFlow);
  }

  async saveFlow(flow: WhatsAppFlowDraft): Promise<WhatsAppFlow> {
    const row = { name: flow.name, enabled: flow.enabled, graph: flow.graph };
    const query = flow.id
      ? this.client.from("whatsapp_flows").update(row).eq("id", flow.id)
      : this.client.from("whatsapp_flows").insert(row);
    const { data, error } = await query.select(FLOW_COLUMNS).single();
    if (error) fail(error);
    return toFlow(data);
  }

  async deleteFlow(id: string): Promise<void> {
    const { error } = await this.client.from("whatsapp_flows").delete().eq("id", id);
    if (error) fail(error);
  }
}
