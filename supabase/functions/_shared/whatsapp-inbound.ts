// O que acontece com cada mensagem do cliente: registra, decide se a IA responde, responde (ou só registra, no modo
// teste), segue o fluxo desenhado em Automação > Fluxos e chama o Jota quando precisa. Usado pela whatsapp-webhook (Meta) e pelo "Simular cliente" do painel.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.117.3";
import { CloudSendError, sendCloudOptions, sendCloudText } from "./whatsapp-cloud.ts";
import { answerFlow, parseFlowGraph, pickFlow, renderWithOptions, startFlow, type FlowContactKind, type FlowStep } from "./whatsapp-flow.ts";
import { loadAiConfig, runAssistant, type ChatTurn } from "./whatsapp-ai.ts";
import { aiAnswersAt, isBusinessHours, isOptIn, isOptOut, type AiSchedule, type BusinessHours } from "./whatsapp-schedule.ts";

export interface InboundMessage {
  /** Só dígitos, com DDI (formato da Meta). */
  phone: string;
  name: string | null;
  body: string;
  waMessageId: string | null;
}

interface Settings {
  mode: "test" | "live";
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

export type InboundOutcome = "duplicate" | "ignored" | "opted_out" | "staff" | "ai_off" | "replied" | "handoff" | "flow";

const OPT_OUT_REPLY = "Pronto, não vou mais mandar mensagens automáticas. Se quiser voltar, é só escrever *voltar*.";
const OPT_IN_REPLY = "Combinado, o atendimento automático voltou. Como posso te ajudar?";
const FAILURE_SUMMARY = "A IA não conseguiu responder esta mensagem. Responda pelo painel.";
const FLOW_HANDOFF_SUMMARY = "O fluxo passou a conversa para você.";

async function settingsOf(admin: SupabaseClient): Promise<Settings> {
  const { data, error } = await admin
    .from("whatsapp_settings")
    .select("mode, ai_enabled, ai_schedule, business_start, business_end, business_days, ignored_numbers")
    .single();
  if (error) throw error;
  return data as Settings;
}

/** Envia (modo live) ou só registra (modo teste) uma mensagem da loja na conversa. */
export async function recordOutbound(
  admin: SupabaseClient,
  contactId: string,
  phone: string,
  author: "ai" | "staff" | "system",
  body: string,
  mode: "test" | "live",
  /** Pergunta de fluxo: sai como botões ou lista; na conversa fica o texto com as opções numeradas. */
  options: readonly string[] = [],
): Promise<{ status: "test" | "sent" | "failed"; error: string | null }> {
  let status: "test" | "sent" | "failed" = "test";
  let waId: string | null = null;
  let error: string | null = null;
  if (mode === "live") {
    try {
      waId = options.length > 0 ? await sendCloudOptions(phone, body, options) : await sendCloudText(phone, body);
      status = "sent";
    } catch (reason) {
      if (!(reason instanceof CloudSendError)) throw reason;
      status = "failed";
      error = reason.message;
    }
  }
  const recorded = renderWithOptions(body, options);
  const { error: insertError } = await admin
    .from("whatsapp_chat")
    .insert({ contact_id: contactId, direction: "out", author, body: recorded, status, error, wa_message_id: waId });
  if (insertError) throw insertError;
  const { error: updateError } = await admin
    .from("whatsapp_contacts")
    // Respondida pela loja (IA, Jota ou aviso automático): sai da contagem de "esperando você".
    .update({ last_message_at: new Date().toISOString(), last_message_preview: recorded.slice(0, 160), unread_count: 0 })
    .eq("id", contactId);
  if (updateError) throw updateError;
  return { status, error };
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

/** Passa a conversa para o Jota e avisa no celular (sininho + push, kind whatsapp). */
export async function handOff(admin: SupabaseClient, contactId: string, name: string | null, summary: string) {
  const { error } = await admin.from("whatsapp_contacts").update({ handler: "staff", handoff_summary: summary.slice(0, 1000), unread_count: 1 }).eq("id", contactId);
  if (error) throw error;
  await notify(admin, contactId, `${name ?? "Cliente"} está esperando você no WhatsApp`, summary);
}

async function notify(admin: SupabaseClient, contactId: string, title: string, body: string) {
  const { error } = await admin.from("notifications").insert({
    kind: "whatsapp",
    title: title.slice(0, 120),
    body: body.slice(0, 500) || null,
    link: `/admin/whatsapp?c=${contactId}`,
  });
  // O aviso é extra: falhar aqui não pode impedir a resposta ao cliente.
  if (error) console.error("whatsapp notify", error);
}

type FlowResult = "handled" | "ai" | "none";

interface FlowState {
  kind: FlowContactKind;
  flow_id: string | null;
  flow_node: string | null;
}

/** Segue o fluxo em que a conversa parou ou começa o que casar com a mensagem. "ai" = o fluxo passou para a IA. */
async function runFlows(
  admin: SupabaseClient,
  contact: Registered,
  message: InboundMessage,
  mode: "test" | "live",
  hours: BusinessHours,
): Promise<FlowResult> {
  const [flowsResult, stateResult] = await Promise.all([
    admin.from("whatsapp_flows").select("id, graph").eq("enabled", true).order("position").order("created_at"),
    admin.from("whatsapp_contacts").select("kind, flow_id, flow_node").eq("id", contact.contact_id).single(),
  ]);
  if (flowsResult.error) throw flowsResult.error;
  if (stateResult.error) throw stateResult.error;
  const flows = (flowsResult.data as { id: string; graph: unknown }[]).map((row) => ({ id: row.id, graph: parseFlowGraph(row.graph) }));
  const state = stateResult.data as FlowState;
  const context = { kind: state.kind, businessHours: isBusinessHours(hours, new Date()) };

  let flowId: string | null = null;
  let step: FlowStep | null = null;
  const waiting = state.flow_id && state.flow_node ? flows.find((flow) => flow.id === state.flow_id) : undefined;
  if (waiting && state.flow_node) {
    const answered = answerFlow(waiting.graph, state.flow_node, message.body, context);
    // A pergunta pode ter sido apagada do fluxo enquanto o cliente pensava: aí a mensagem segue como nova.
    if (answered.actions.length > 0 || answered.waitingAt) {
      flowId = waiting.id;
      step = answered;
    }
  }
  if (!step) {
    const picked = pickFlow(flows, { body: message.body, isNew: contact.is_new });
    if (picked) {
      flowId = picked.id;
      step = startFlow(picked.graph, context);
    }
  }

  const nextState = { flow_id: step?.waitingAt ? flowId : null, flow_node: step?.waitingAt ?? null };
  if (nextState.flow_id !== state.flow_id || nextState.flow_node !== state.flow_node) {
    const { error } = await admin.from("whatsapp_contacts").update(nextState).eq("id", contact.contact_id);
    if (error) throw error;
  }
  if (!step || (step.actions.length === 0 && !step.waitingAt)) return "none";

  for (const action of step.actions) {
    if (action.type === "send") {
      await recordOutbound(admin, contact.contact_id, message.phone, "system", action.text, mode, action.options);
    } else if (action.type === "handoff") {
      await handOff(admin, contact.contact_id, message.name, action.note.trim() || FLOW_HANDOFF_SUMMARY);
      return "handled";
    } else {
      return "ai";
    }
  }
  return "handled";
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
  const flow = await runFlows(admin, contact, message, mode, hours);
  if (flow === "handled") return "flow";

  if (!settings.ai_enabled || !aiAnswersAt(hours, new Date())) {
    if (contact.unread_count === 1) await notify(admin, contact.contact_id, `${message.name ?? "Cliente"} mandou mensagem`, message.body);
    return "ai_off";
  }

  try {
    const result = await runAssistant(admin, {
      config: await loadAiConfig(admin),
      history: await historyOf(admin, contact.contact_id),
      phone: message.phone,
      // Se o fluxo já deu as boas-vindas, a IA não repete.
      firstContact: contact.is_new && flow === "none",
    });
    if (result.reply) await recordOutbound(admin, contact.contact_id, message.phone, "ai", result.reply, mode);
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
