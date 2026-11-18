// Ações do painel no WhatsApp (abas WhatsApp e Automação), com o token de quem está logado.
// Só quem tem a área Automação (o Jota, a Lay ou ajudante com essa área) usa.
//   simulate:         testa a IA com a configuração da tela (mesmo sem salvar). Nada é gravado nem enviado.
//   reply:            o Jota responde o cliente pelo painel. A conversa passa a ser dele (a IA para de responder).
//   simulate_inbound: no modo teste, finge uma mensagem de cliente e roda o fluxo inteiro (IA, passagem, avisos).
//
// Deploy: npx supabase functions deploy whatsapp-panel
// Segredos: ANTHROPIC_API_KEY e, no modo live, WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.117.3";
import { enabledFlows, loadAiConfig, playbookOf, runAssistant, type AiConfig, type ChatTurn } from "../_shared/whatsapp-ai.ts";
import { FLOW_LIMITS, parseFlowGraph } from "../_shared/whatsapp-flow.ts";
import { insideWindow } from "../_shared/whatsapp-cloud.ts";
import { processInbound, recordOutbound } from "../_shared/whatsapp-inbound.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ErrorCode = "forbidden" | "invalid" | "not_found" | "window_closed" | "not_test" | "ai_unavailable" | "server";

const STATUS: Record<ErrorCode, number> = {
  forbidden: 403,
  invalid: 400,
  not_found: 404,
  window_closed: 409,
  not_test: 409,
  ai_unavailable: 503,
  server: 500,
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

const failWith = (code: ErrorCode) => json({ error: code }, STATUS[code]);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown, max: number): string | null =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max ? value.trim() : null;

/** Rascunho da tela de IA: valida com os mesmos limites do banco. Sem rascunho, vale o que está salvo. */
function parseDraft(raw: unknown, saved: AiConfig): AiConfig | null {
  if (raw === undefined) return saved;
  if (!isRecord(raw)) return null;
  const greeting = text(raw.greeting, 1000);
  const tone = text(raw.tone, 600);
  const instructions = typeof raw.instructions === "string" && raw.instructions.length <= 4000 ? raw.instructions : null;
  if (!greeting || !tone || instructions === null || !Array.isArray(raw.faq) || raw.faq.length > 100) return null;
  const faq = raw.faq.map((item) => (isRecord(item) ? { question: text(item.question, 300), answer: text(item.answer, 2000) } : null));
  if (faq.some((item) => !item || !item.question || !item.answer)) return null;
  return { ...saved, greeting, tone, instructions, faq: faq as AiConfig["faq"] };
}

function parseHistory(raw: unknown): ChatTurn[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 40) return null;
  const turns = raw.map((item) =>
    isRecord(item) && (item.role === "user" || item.role === "assistant") ? { role: item.role, text: text(item.text, 4096) } : null,
  );
  if (turns.some((turn) => !turn || !turn.text)) return null;
  return turns as ChatTurn[];
}

const CONTACT_KIND_LABEL: Record<string, string> = {
  lead: "interessado (ainda não comprou)",
  customer: "cliente (já comprou)",
  affiliate: "afiliado",
  student: "aluno",
};

/**
 * Fluxo da tela de Fluxos, mesmo sem salvar e mesmo desligado: entra no roteiro no lugar da versão salva.
 * Os demais fluxos ligados continuam valendo, como no atendimento real.
 */
async function withDraftFlow(admin: SupabaseClient, config: AiConfig, raw: unknown): Promise<AiConfig | null> {
  if (raw === undefined) return config;
  if (!isRecord(raw)) return null;
  const name = text(raw.name, 80);
  const graph = parseFlowGraph(raw.graph);
  if (!name || graph.nodes.length > FLOW_LIMITS.nodes) return null;
  const id = typeof raw.id === "string" ? raw.id : null;
  const { data, error } = await admin.from("whatsapp_flows").select("id, name, graph").eq("enabled", true).order("position").order("created_at");
  if (error) throw error;
  const others = enabledFlows(data).filter((flow) => flow.id !== id);
  return { ...config, playbook: playbookOf([...others, { name, graph }]) };
}

async function simulate(admin: SupabaseClient, body: Record<string, unknown>): Promise<Response> {
  const history = parseHistory(body.history);
  if (!history) return failWith("invalid");
  const drafted = parseDraft(body.draft ?? undefined, await loadAiConfig(admin));
  const config = drafted && (await withDraftFlow(admin, drafted, body.flow ?? undefined));
  if (!config) return failWith("invalid");
  const kind = typeof body.contactKind === "string" ? CONTACT_KIND_LABEL[body.contactKind] : undefined;
  if (!Deno.env.get("ANTHROPIC_API_KEY")) return failWith("ai_unavailable");
  const firstContact = history.filter((turn) => turn.role === "user").length === 1;
  const context = { kindLabel: kind ?? CONTACT_KIND_LABEL.lead!, businessHours: body.businessHours !== false };
  const result = await runAssistant(admin, { config, history, phone: null, firstContact, context });
  return json(result);
}

async function reply(admin: SupabaseClient, body: Record<string, unknown>): Promise<Response> {
  const contactId = typeof body.contactId === "string" && /^[0-9a-f-]{36}$/i.test(body.contactId) ? body.contactId : null;
  const message = text(body.text, 4096);
  if (!contactId || !message) return failWith("invalid");

  const [{ data: contact, error }, { data: settings, error: settingsError }] = await Promise.all([
    admin.from("whatsapp_contacts").select("id, phone, last_inbound_at").eq("id", contactId).maybeSingle(),
    admin.from("whatsapp_settings").select("mode").single(),
  ]);
  if (error) throw error;
  if (settingsError) throw settingsError;
  if (!contact) return failWith("not_found");
  const mode = settings.mode === "live" ? "live" : "test";
  if (mode === "live" && !insideWindow(contact.last_inbound_at)) return failWith("window_closed");

  // O Jota respondeu: a conversa é dele até devolver para a IA.
  const { error: handlerError } = await admin.from("whatsapp_contacts").update({ handler: "staff" }).eq("id", contactId);
  if (handlerError) throw handlerError;
  const result = await recordOutbound(admin, contactId, contact.phone, "staff", message, mode);
  return json(result);
}

async function simulateInbound(admin: SupabaseClient, body: Record<string, unknown>): Promise<Response> {
  const { data: settings, error } = await admin.from("whatsapp_settings").select("mode").single();
  if (error) throw error;
  if (settings.mode !== "test") return failWith("not_test");
  const phone = typeof body.phone === "string" ? body.phone.replace(/\D/g, "") : "";
  const message = text(body.text, 4096);
  const name = body.name === undefined || body.name === null ? null : text(body.name, 120);
  if (!/^\d{10,15}$/.test(phone) || !message) return failWith("invalid");
  const outcome = await processInbound(admin, { phone, name, body: message, waMessageId: null }, "test");
  const { data: contact, error: contactError } = await admin.from("whatsapp_contacts").select("id").eq("phone", phone).single();
  if (contactError) throw contactError;
  return json({ outcome, contactId: contact.id });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (request.method !== "POST") return json({ error: "method" }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization) return failWith("forbidden");
  const url = Deno.env.get("SUPABASE_URL")!;
  const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: allowed, error: permissionError } = await caller.rpc("has_permission", { p_permission: "automation" });
  if (permissionError || allowed !== true) return failWith("forbidden");

  const body = await request.json().catch(() => null);
  if (!isRecord(body)) return failWith("invalid");
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  try {
    if (body.action === "simulate") return await simulate(admin, body);
    if (body.action === "reply") return await reply(admin, body);
    if (body.action === "simulate_inbound") return await simulateInbound(admin, body);
    return failWith("invalid");
  } catch (error) {
    console.error("whatsapp-panel", body.action, error);
    return failWith("server");
  }
});
