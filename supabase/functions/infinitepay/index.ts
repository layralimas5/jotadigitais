// Cobrança no cartão pela InfinitePay (Checkout Integrado). Roda no Supabase (Deno) com a chave de serviço.
//
// Ações (POST com JSON):
//   { action: "checkout", code, paymentId }                 -> cria (ou reaproveita) o link de pagamento da parte
//   { action: "confirm", orderNsu, transactionNsu, slug }   -> volta do checkout: confere na InfinitePay e marca pago
//   ?action=webhook (corpo da InfinitePay)                  -> aviso de pagamento: confere e marca pago
//
// Nada é marcado como pago só porque alguém avisou: toda confirmação passa pelo payment_check da InfinitePay.
//
// Segredos (npx supabase secrets set ...): INFINITEPAY_HANDLE (InfiniteTag sem o $), SITE_URL (ex.: https://jotadigitais.com.br)
// Deploy: npx supabase functions deploy infinitepay --no-verify-jwt   (o webhook da InfinitePay não manda token do Supabase)
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.117.3";

const API = "https://api.checkout.infinitepay.io";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ErrorCode = "invalid" | "not_found" | "unavailable" | "not_paid" | "gateway" | "server";

const STATUS: Record<ErrorCode, number> = {
  invalid: 400,
  not_found: 404,
  unavailable: 409,
  not_paid: 402,
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

/** InfinitePay pede o telefone com DDI: +5511999887766. */
function phoneOf(whatsapp: string | null): string | undefined {
  const digits = (whatsapp ?? "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  if (digits.length === 12 || digits.length === 13) return `+${digits}`;
  return undefined;
}

interface PaymentRow {
  id: string;
  position: number;
  method: string;
  amount_cents: number;
  status: string;
  checkout_url: string | null;
  orders: {
    code: string;
    status: string;
    expires_at: string;
    customer_name: string;
    customer_email: string;
    customer_whatsapp: string | null;
    account_handle: string;
  };
}

async function createCheckout(service: SupabaseClient, body: Record<string, unknown>): Promise<Response> {
  const code = text(body.code, 20)?.toUpperCase();
  const paymentId = text(body.paymentId, 36);
  if (!code || !paymentId || !UUID.test(paymentId)) return failWith("invalid");

  const { data, error } = await service
    .from("order_payments")
    .select(
      "id, position, method, amount_cents, status, checkout_url, orders!inner(code, status, expires_at, customer_name, customer_email, customer_whatsapp, account_handle)",
    )
    .eq("id", paymentId)
    .eq("orders.code", code)
    .maybeSingle<PaymentRow>();
  if (error) throw error;
  if (!data) return failWith("not_found");

  const order = data.orders;
  const open = order.status === "awaiting_payment" && new Date(order.expires_at).getTime() > Date.now();
  if (data.method !== "card" || data.status !== "pending" || !open) return failWith("unavailable");
  if (data.checkout_url) return json({ url: data.checkout_url });

  const response = await fetch(`${API}/links`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      handle: env("INFINITEPAY_HANDLE"),
      order_nsu: data.id,
      items: [{ quantity: 1, price: data.amount_cents, description: `Conta ${order.account_handle} - pedido ${order.code}` }],
      redirect_url: `${env("SITE_URL")}/pedido/${order.code}`,
      webhook_url: `${env("SUPABASE_URL")}/functions/v1/infinitepay?action=webhook`,
      customer: { name: order.customer_name, email: order.customer_email, phone_number: phoneOf(order.customer_whatsapp) },
    }),
  });
  if (!response.ok) {
    console.error("InfinitePay recusou o link", response.status, await response.text());
    return failWith("gateway");
  }
  const created = (await response.json()) as Record<string, unknown>;
  const url = text(created.url, 500) ?? text(created.link, 500) ?? text(created.checkout_url, 500);
  if (!url?.startsWith("https://")) {
    console.error("Resposta da InfinitePay sem link", Object.keys(created));
    return failWith("gateway");
  }

  const { error: saveError } = await service.from("order_payments").update({ checkout_url: url }).eq("id", data.id);
  if (saveError) throw saveError;
  return json({ url });
}

interface PaymentCheck {
  paymentId: string;
  transactionNsu: string;
  slug: string;
  receiptUrl: string | null;
}

type CheckResult = "paid" | "not_paid" | "gateway";

/** Pergunta à InfinitePay se a transação foi paga e, se foi, grava na parte do pedido. */
async function verifyAndSettle(service: SupabaseClient, check: PaymentCheck): Promise<CheckResult> {
  const response = await fetch(`${API}/payment_check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      handle: env("INFINITEPAY_HANDLE"),
      order_nsu: check.paymentId,
      transaction_nsu: check.transactionNsu,
      slug: check.slug,
    }),
  });
  if (!response.ok) {
    console.error("payment_check falhou", response.status);
    return "gateway";
  }
  const result = (await response.json()) as { success?: boolean; paid?: boolean; paid_amount?: number; installments?: number };
  if (!result.success || !result.paid || typeof result.paid_amount !== "number") return "not_paid";

  const { data, error } = await service.rpc("confirm_card_payment", {
    p_payment_id: check.paymentId,
    p_transaction_nsu: check.transactionNsu,
    p_slug: check.slug,
    p_paid_amount_cents: Math.round(result.paid_amount),
    p_installments: typeof result.installments === "number" ? result.installments : null,
    p_receipt_url: check.receiptUrl,
  });
  if (error) throw error;
  return data === true ? "paid" : "not_paid";
}

function checkFrom(orderNsu: unknown, transactionNsu: unknown, slug: unknown, receiptUrl: unknown): PaymentCheck | null {
  const paymentId = text(orderNsu, 36);
  const transaction = text(transactionNsu);
  const invoice = text(slug);
  if (!paymentId || !UUID.test(paymentId) || !transaction || !invoice) return null;
  return { paymentId, transactionNsu: transaction, slug: invoice, receiptUrl: text(receiptUrl, 500) };
}

async function confirmReturn(service: SupabaseClient, body: Record<string, unknown>): Promise<Response> {
  const check = checkFrom(body.orderNsu, body.transactionNsu, body.slug, body.receiptUrl);
  if (!check) return failWith("invalid");
  const result = await verifyAndSettle(service, check);
  if (result === "gateway") return failWith("gateway");
  return result === "paid" ? json({ paid: true }) : failWith("not_paid");
}

/** 400 faz a InfinitePay tentar de novo: só quando a conferência falhou do nosso lado ou do dela. */
async function webhook(service: SupabaseClient, body: Record<string, unknown>): Promise<Response> {
  const check = checkFrom(body.order_nsu, body.transaction_nsu, body.invoice_slug, body.receipt_url);
  if (!check) return json({ ignored: true });
  const result = await verifyAndSettle(service, check);
  return result === "gateway" ? json({ retry: true }, 400) : json({ ok: true });
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
    if (action === "checkout") return await createCheckout(service, body);
    if (action === "confirm") return await confirmReturn(service, body);
    if (action === "webhook") return await webhook(service, body);
    return failWith("invalid");
  } catch (error) {
    console.error(error);
    return action === "webhook" ? json({ retry: true }, 400) : failWith("server");
  }
});
