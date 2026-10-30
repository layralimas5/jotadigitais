// Pix automático pelo C6 Bank (API Pix padrão Bacen). Roda no Supabase (Deno) com a chave de serviço.
//
// Ações (POST com JSON):
//   { action: "charge", code, paymentId }   -> cria (ou reaproveita) a cobrança imediata e devolve o copia e cola
//   { action: "check", code, paymentId }    -> consulta a cobrança no C6 e, se foi paga, marca a parte como paga
//   ?action=webhook (corpo do C6)           -> aviso de Pix recebido: consulta a cobrança e marca paga
//
// Nada é marcado como pago só porque alguém avisou: toda confirmação consulta GET /v2/pix/cob/{txid} no C6.
//
// O C6 exige mTLS (certificado do portal de desenvolvedor) no token e em todas as chamadas.
// Segredos: C6_CLIENT_ID, C6_CLIENT_SECRET, C6_CERT e C6_KEY (PEM, ou o PEM em base64),
//           C6_PIX_KEY (chave Pix cadastrada na conta C6 do Jota), C6_ENV=sandbox para testar.
// Deploy: npx supabase functions deploy c6-pix --no-verify-jwt   (o webhook do C6 não manda token do Supabase)
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.117.3";

const API = Deno.env.get("C6_ENV") === "sandbox" ? "https://baas-api-sandbox.c6bank.info" : "https://baas-api.c6bank.info";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ErrorCode = "invalid" | "not_found" | "unavailable" | "gateway" | "server";

const STATUS: Record<ErrorCode, number> = {
  invalid: 400,
  not_found: 404,
  unavailable: 409,
  gateway: 502,
  server: 500,
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

const failWith = (code: ErrorCode) => json({ error: code }, STATUS[code]);

const text = (value: unknown, max = 200) => (typeof value === "string" && value.length > 0 && value.length <= max ? value : null);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Segredo ${name} não configurado.`);
  return value;
}

/** O painel do Supabase pode estragar a quebra de linha do PEM; em base64 ele chega inteiro. */
function pem(name: string): string {
  const value = env(name).trim();
  return value.includes("-----BEGIN") ? value.replace(/\\n/g, "\n") : atob(value);
}

let mtlsClient: Deno.HttpClient | null = null;

function c6Client(): Deno.HttpClient {
  mtlsClient ??= Deno.createHttpClient({ cert: pem("C6_CERT"), key: pem("C6_KEY") });
  return mtlsClient;
}

class GatewayError extends Error {}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;
  const response = await fetch(`${API}/v1/auth/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: env("C6_CLIENT_ID"),
      client_secret: env("C6_CLIENT_SECRET"),
    }),
    client: c6Client(),
  });
  if (!response.ok) throw new GatewayError(`Token do C6 recusado (${response.status}): ${await response.text()}`);
  const body = (await response.json()) as { access_token?: unknown; expires_in?: unknown };
  const value = text(body.access_token, 4096);
  if (!value) throw new GatewayError("Resposta do token do C6 sem access_token.");
  const ttl = typeof body.expires_in === "number" ? body.expires_in : 300;
  cachedToken = { value, expiresAt: Date.now() + Math.max(ttl - 30, 10) * 1000 };
  return value;
}

async function c6(method: "GET" | "PUT", path: string, body?: unknown): Promise<Response> {
  return fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    client: c6Client(),
  });
}

interface Cob {
  txid?: string;
  status?: string;
  pixCopiaECola?: string;
  pix?: { endToEndId?: string; valor?: string }[];
}

async function getCob(txid: string): Promise<Cob> {
  const response = await c6("GET", `/v2/pix/cob/${txid}`);
  if (!response.ok) throw new GatewayError(`Consulta da cobrança ${txid} falhou (${response.status}): ${await response.text()}`);
  return (await response.json()) as Cob;
}

const centsOf = (valor: string | undefined) => {
  const amount = Number(valor);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
};

/** Uma vez por instância da função: aponta o webhook da chave Pix para cá. Falha só vai para o log. */
let webhookReady = false;

async function ensureWebhook(): Promise<void> {
  if (webhookReady) return;
  const key = encodeURIComponent(env("C6_PIX_KEY"));
  const webhookUrl = `${env("SUPABASE_URL")}/functions/v1/c6-pix?action=webhook`;
  try {
    const current = await c6("GET", `/v2/pix/webhook/${key}`);
    if (current.ok && ((await current.json()) as { webhookUrl?: string }).webhookUrl === webhookUrl) {
      webhookReady = true;
      return;
    }
    const response = await c6("PUT", `/v2/pix/webhook/${key}`, { webhookUrl });
    if (!response.ok) throw new GatewayError(`Cadastro do webhook recusado (${response.status}): ${await response.text()}`);
    webhookReady = true;
  } catch (error) {
    console.error("Webhook do Pix C6 não cadastrado; a página do pedido continua conferindo sozinha.", error);
  }
}

interface PaymentRow {
  id: string;
  method: string;
  amount_cents: number;
  status: string;
  pix_txid: string | null;
  pix_copy_paste: string | null;
  orders: { code: string; status: string; expires_at: string };
}

async function findPart(service: SupabaseClient, body: Record<string, unknown>): Promise<PaymentRow | null> {
  const code = text(body.code, 20)?.toUpperCase();
  const paymentId = text(body.paymentId, 36);
  if (!code || !paymentId || !UUID.test(paymentId)) return null;
  const { data, error } = await service
    .from("order_payments")
    .select("id, method, amount_cents, status, pix_txid, pix_copy_paste, orders!inner(code, status, expires_at)")
    .eq("id", paymentId)
    .eq("orders.code", code)
    .maybeSingle<PaymentRow>();
  if (error) throw error;
  return data?.method === "pix" ? data : null;
}

/** txid do Bacen: 26 a 35 letras e números. O id da parte sem hífens tem 32. */
const txidOf = (paymentId: string) => paymentId.replace(/-/g, "");

async function createCharge(service: SupabaseClient, body: Record<string, unknown>): Promise<Response> {
  const part = await findPart(service, body);
  if (!part) return failWith("not_found");

  const secondsLeft = Math.floor((new Date(part.orders.expires_at).getTime() - Date.now()) / 1000);
  if (part.status !== "pending" || part.orders.status !== "awaiting_payment" || secondsLeft < 60) return failWith("unavailable");
  if (part.pix_copy_paste) return json({ pixCode: part.pix_copy_paste });

  const txid = txidOf(part.id);
  let response = await c6("PUT", `/v2/pix/cob/${txid}`, {
    calendario: { expiracao: secondsLeft },
    valor: { original: (part.amount_cents / 100).toFixed(2) },
    chave: env("C6_PIX_KEY"),
    solicitacaoPagador: `Jota Digitais - pedido ${part.orders.code}`,
  });
  // Cobrança já criada numa tentativa anterior que não chegou a gravar: reaproveita.
  if (response.status === 409) response = await c6("GET", `/v2/pix/cob/${txid}`);
  if (!response.ok) throw new GatewayError(`C6 recusou a cobrança (${response.status}): ${await response.text()}`);

  const cob = (await response.json()) as Cob;
  const pixCode = text(cob.pixCopiaECola, 512);
  if (!pixCode) throw new GatewayError(`Cobrança sem pixCopiaECola: ${Object.keys(cob).join(", ")}`);

  const { error } = await service
    .from("order_payments")
    .update({ provider: "c6", pix_txid: txid, pix_copy_paste: pixCode })
    .eq("id", part.id)
    .eq("status", "pending");
  if (error) throw error;

  await ensureWebhook();
  return json({ pixCode });
}

/** Consulta no C6 e, com a cobrança concluída e o valor inteiro recebido, grava a parte como paga. */
async function settle(service: SupabaseClient, paymentId: string, txid: string): Promise<boolean> {
  const cob = await getCob(txid);
  const received = cob.pix ?? [];
  if (cob.status !== "CONCLUIDA" || received.length === 0) return false;
  const paidCents = received.reduce((sum, pix) => sum + centsOf(pix.valor), 0);
  const { data, error } = await service.rpc("confirm_c6_pix_payment", {
    p_payment_id: paymentId,
    p_txid: txid,
    p_end_to_end_id: received[0].endToEndId ?? txid,
    p_paid_amount_cents: paidCents,
  });
  if (error) throw error;
  return data === true;
}

async function checkCharge(service: SupabaseClient, body: Record<string, unknown>): Promise<Response> {
  const part = await findPart(service, body);
  if (!part) return failWith("not_found");
  if (part.status === "paid") return json({ paid: true });
  if (part.status !== "pending" || !part.pix_txid) return json({ paid: false });
  return json({ paid: await settle(service, part.id, part.pix_txid) });
}

/** O aviso do C6 pode vir como no Bacen ({ pix: [...] }) ou com o JSON dentro de "information". */
function txidsFrom(body: Record<string, unknown>): string[] {
  let payload: unknown = body;
  if (typeof body.information === "string") {
    try {
      payload = JSON.parse(body.information);
    } catch {
      return [];
    }
  }
  const items = Array.isArray((payload as { pix?: unknown }).pix) ? (payload as { pix: unknown[] }).pix : [payload];
  return items
    .map((item) => text((item as { txid?: unknown } | null)?.txid, 35))
    .filter((txid): txid is string => txid !== null && /^[a-zA-Z0-9]{26,35}$/.test(txid));
}

/** 500 faz o C6 tentar de novo: só quando a conferência falhou do nosso lado ou do dele. */
async function webhook(service: SupabaseClient, body: Record<string, unknown>): Promise<Response> {
  for (const txid of txidsFrom(body)) {
    const { data, error } = await service.from("order_payments").select("id, status").eq("pix_txid", txid).maybeSingle<{ id: string; status: string }>();
    if (error) throw error;
    if (data?.status === "pending") await settle(service, data.id, txid);
  }
  return json({ ok: true });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (request.method !== "POST") return failWith("invalid");

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return failWith("invalid");
  }

  const service = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const action = new URL(request.url).searchParams.get("action") === "webhook" ? "webhook" : body.action;

  try {
    if (action === "charge") return await createCharge(service, body);
    if (action === "check") return await checkCharge(service, body);
    if (action === "webhook") return await webhook(service, body);
    return failWith("invalid");
  } catch (error) {
    console.error(error);
    if (action === "webhook") return json({ retry: true }, 500);
    // Sem certificado ou com o C6 fora do ar, o site volta para o QR Code estático da chave.
    const gatewayDown = error instanceof GatewayError || (error instanceof Error && error.message.startsWith("Segredo"));
    return failWith(gatewayDown ? "gateway" : "server");
  }
});
