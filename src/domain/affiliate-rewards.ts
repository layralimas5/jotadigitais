import { commissionCents, commissionStateOf, type AffiliateAnnouncement, type AffiliateCommission, type CommissionRule } from "./affiliate";
import { formatBRL, type Cents } from "./money";

/**
 * Entregas 2 e 3 dos afiliados: pagamento, saldo para comprar conta, brindes, avisos do painel e exemplos de ganho.
 * Mesmas regras de supabase/migrations/20270101120000_affiliates_v2.sql e 20270103120000_affiliates_v3.sql.
 */

// ---------------------------------------------------------------------------
// Pagamento (desde a entrega 3, sem lote: toda comissão liberada pode ser paga)
// ---------------------------------------------------------------------------

export interface AffiliatePayout {
  id: string;
  affiliateId: string;
  commissionsCount: number;
  amount: Cents;
  pixKey: string | null;
  note: string | null;
  /** Saldo usado numa compra (código de saldo), e não Pix. Esse não se desfaz. */
  usedInPurchase: boolean;
  paidAt: string;
}

/** Vendas da página "Seja afiliado" no exemplo de ganho ("a cada 10 vendas"). */
export const MIN_INCENTIVE_SALES = 1;
export const MAX_INCENTIVE_SALES = 100;

export interface PayoutStatus {
  /** Liberadas (garantia acabou), não pagas e fora de código de saldo: o que o Jota pode pagar agora. */
  ready: AffiliateCommission[];
  readyAmount: Cents;
  /** Ainda na garantia (ou o pedido nem foi entregue). */
  inGuarantee: AffiliateCommission[];
  inGuaranteeAmount: Cents;
  /** Liberadas, mas reservadas num código de saldo para comprar conta. */
  reservedAmount: Cents;
  paidCount: number;
  paidAmount: Cents;
  /** Quando o afiliado pediu o pagamento. */
  requestedAt: string | null;
}

const byOldest = (a: AffiliateCommission, b: AffiliateCommission) => a.createdAt.localeCompare(b.createdAt);
const sumAmounts = (items: readonly AffiliateCommission[]) => items.reduce((total, item) => total + item.amount, 0);

export function payoutStatusOf(commissions: readonly AffiliateCommission[], requestedAt: string | null, now: Date = new Date()): PayoutStatus {
  const released = commissions.filter((commission) => commissionStateOf(commission, now) === "released");
  const ready = released.filter((commission) => commission.balanceCouponId === null).sort(byOldest);
  const inGuarantee = commissions.filter((commission) => commissionStateOf(commission, now) === "pending").sort(byOldest);
  const paid = commissions.filter((commission) => commission.status === "paid");
  return {
    ready,
    readyAmount: sumAmounts(ready),
    inGuarantee,
    inGuaranteeAmount: sumAmounts(inGuarantee),
    reservedAmount: sumAmounts(released.filter((commission) => commission.balanceCouponId !== null)),
    paidCount: paid.length,
    paidAmount: sumAmounts(paid),
    requestedAt,
  };
}

/** O afiliado pode pedir de novo 24 horas depois do último pedido. */
export const PAYOUT_REQUEST_COOLDOWN_MS = 24 * 3_600_000;

export function canRequestPayout(status: PayoutStatus, now: Date = new Date()): boolean {
  if (status.readyAmount <= 0) return false;
  return status.requestedAt === null || now.getTime() - Date.parse(status.requestedAt) >= PAYOUT_REQUEST_COOLDOWN_MS;
}

export const PAYOUT_REQUEST_ERRORS = ["nothing_to_pay", "payout_already_requested"] as const;
export type PayoutRequestError = (typeof PAYOUT_REQUEST_ERRORS)[number];

export const PAYOUT_REQUEST_MESSAGE: Record<PayoutRequestError, string> = {
  nothing_to_pay: "Ainda não há saldo liberado. Ele aparece quando a garantia de uma venda acaba.",
  payout_already_requested: "Você já pediu o pagamento nas últimas 24 horas. A loja já recebeu o aviso.",
};

// ---------------------------------------------------------------------------
// Saldo para comprar conta (código de saldo)
// ---------------------------------------------------------------------------

export interface AffiliateBalanceCoupon {
  code: string;
  value: Cents;
  /** Já está num pedido em aberto: não dá para cancelar. */
  inUse: boolean;
}

/** Valor mínimo de saldo para gerar o código (o mesmo mínimo de cupom de valor fixo). */
export const MIN_BALANCE_COUPON_CENTS = 100;

export const BALANCE_COUPON_ERRORS = ["balance_too_low", "balance_too_high", "balance_coupon_not_found", "balance_coupon_in_use"] as const;
export type BalanceCouponError = (typeof BALANCE_COUPON_ERRORS)[number];

export const BALANCE_COUPON_MESSAGE: Record<BalanceCouponError, string> = {
  balance_too_low: "Você ainda não tem saldo liberado para gerar o código.",
  balance_too_high: "Seu saldo passou do limite de um código. Peça o pagamento por Pix.",
  balance_coupon_not_found: "Você não tem um código de saldo valendo.",
  balance_coupon_in_use: "Esse código está num pedido em aberto. Espere o pedido ser pago ou cancelado.",
};

export const balanceCouponErrorOf = (message: string): BalanceCouponError | null => BALANCE_COUPON_ERRORS.find((code) => message.includes(code)) ?? null;
export const payoutRequestErrorOf = (message: string): PayoutRequestError | null => PAYOUT_REQUEST_ERRORS.find((code) => message.includes(code)) ?? null;

// ---------------------------------------------------------------------------
// Brindes
// ---------------------------------------------------------------------------

export interface AffiliateGiftData {
  title: string;
  description: string | null;
  /** Para um afiliado só. Nulo = todos os aprovados. */
  affiliateId: string | null;
  expiresAt: string | null;
  active: boolean;
}

export interface AffiliateGift extends AffiliateGiftData {
  id: string;
  createdAt: string;
}

export interface AffiliateGiftClaim {
  giftId: string;
  affiliateId: string;
  claimedAt: string;
  deliveredAt: string | null;
}

export type GiftState = "available" | "claimed" | "delivered" | "expired";

export const GIFT_STATE_LABEL: Record<GiftState, string> = {
  available: "Para receber",
  claimed: "Pedido, a loja vai entregar",
  delivered: "Entregue",
  expired: "Prazo acabou",
};

export function giftStateOf(gift: AffiliateGift, claim: AffiliateGiftClaim | undefined, now: Date = new Date()): GiftState {
  if (claim?.deliveredAt) return "delivered";
  if (claim) return "claimed";
  return gift.expiresAt !== null && new Date(gift.expiresAt) <= now ? "expired" : "available";
}

export const GIFT_ERRORS = ["gift_not_found", "gift_expired"] as const;

export const GIFT_ERROR_MESSAGE: Record<(typeof GIFT_ERRORS)[number], string> = {
  gift_not_found: "Esse brinde não está mais disponível.",
  gift_expired: "O prazo desse brinde acabou.",
};

// ---------------------------------------------------------------------------
// Avisos do painel do afiliado
// ---------------------------------------------------------------------------

export type AffiliateNoticeKind = "sale" | "released" | "canceled" | "payout" | "gift" | "announcement" | "catalog";

export interface AffiliateNotice {
  id: string;
  kind: AffiliateNoticeKind;
  title: string;
  body: string;
  at: string;
  unread: boolean;
}

export interface AffiliateNoticeSources {
  commissions: readonly AffiliateCommission[];
  payouts: readonly AffiliatePayout[];
  gifts: readonly AffiliateGift[];
  claims: readonly AffiliateGiftClaim[];
  announcements: readonly AffiliateAnnouncement[];
  /** Quando entraram as contas novas da vitrine (para "Novidade no catálogo"). */
  newListings: readonly string[];
}

const NOTICE_WINDOW_DAYS = 30;
const MAX_NOTICES = 30;
const DAY_MS = 86_400_000;

const accountName = (commission: AffiliateCommission) => commission.accountHandle ?? `o pedido ${commission.orderCode}`;

/** Linha do tempo do sininho: vendas, liberações, pagamentos, brindes, recados e contas novas dos últimos 30 dias. */
export function affiliateNoticesOf(sources: AffiliateNoticeSources, seenAt: string | null, now: Date = new Date()): AffiliateNotice[] {
  const since = now.getTime() - NOTICE_WINDOW_DAYS * DAY_MS;
  const notices: Omit<AffiliateNotice, "unread">[] = [];

  for (const commission of sources.commissions) {
    notices.push({
      id: `sale:${commission.id}`,
      kind: "sale",
      title: "Venda confirmada!",
      body: `Sua indicação vendeu ${accountName(commission)}. Comissão de ${formatBRL(commission.amount)}.`,
      at: commission.createdAt,
    });
    if (commission.status === "canceled") {
      notices.push({ id: `canceled:${commission.id}`, kind: "canceled", title: "Venda cancelada", body: `A comissão de ${accountName(commission)} foi cancelada.`, at: commission.createdAt });
    } else if (commission.releaseAt !== null && new Date(commission.releaseAt) <= now) {
      notices.push({
        id: `released:${commission.id}`,
        kind: "released",
        title: "Comissão liberada",
        body: `A garantia de ${accountName(commission)} acabou: ${formatBRL(commission.amount)} já podem ser pagos.`,
        at: commission.releaseAt,
      });
    }
  }
  for (const payout of sources.payouts) {
    notices.push({
      id: `payout:${payout.id}`,
      kind: "payout",
      title: payout.usedInPurchase ? "Saldo usado numa compra" : "Pagamento enviado",
      body: payout.usedInPurchase
        ? `Você usou ${formatBRL(payout.amount)} de saldo para comprar uma conta.`
        : `A loja pagou ${formatBRL(payout.amount)} de ${payout.commissionsCount} ${payout.commissionsCount === 1 ? "indicação" : "indicações"}.`,
      at: payout.paidAt,
    });
  }
  const claimed = new Set(sources.claims.map((claim) => claim.giftId));
  for (const gift of sources.gifts) {
    notices.push({
      id: `gift:${gift.id}`,
      kind: "gift",
      title: claimed.has(gift.id) ? "Brinde pedido" : "Você ganhou um brinde!",
      body: claimed.has(gift.id) ? `"${gift.title}" já foi pedido. A loja vai te entregar.` : `"${gift.title}" está esperando você na aba Brindes.`,
      at: gift.createdAt,
    });
  }
  for (const announcement of sources.announcements) {
    notices.push({ id: `announcement:${announcement.id}`, kind: "announcement", title: "Recado da loja", body: announcement.title, at: announcement.createdAt });
  }
  const recentListings = sources.newListings.filter((at) => Date.parse(at) >= since).sort();
  const lastListing = recentListings.at(-1);
  if (lastListing) {
    const count = recentListings.length;
    notices.push({
      id: `catalog:${lastListing}`,
      kind: "catalog",
      title: "Novidade no catálogo",
      body: `${count} ${count === 1 ? "conta nova chegou" : "contas novas chegaram"} para divulgar.`,
      at: lastListing,
    });
  }

  const seen = seenAt ? Date.parse(seenAt) : 0;
  return notices
    .filter((notice) => Date.parse(notice.at) >= since && Date.parse(notice.at) <= now.getTime())
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, MAX_NOTICES)
    .map((notice) => ({ ...notice, unread: Date.parse(notice.at) > seen }));
}

// ---------------------------------------------------------------------------
// Exemplos de ganho
// ---------------------------------------------------------------------------

export interface EarningExample {
  price: Cents;
  commission: Cents;
}

/** Preços de exemplo para quem ainda não vê a vitrine (página "Seja afiliado"). */
export const EXAMPLE_PRICES: readonly Cents[] = [50_000, 150_000, 300_000];

/** "3% de uma conta de R$ 1.500 = R$ 45": o que a pessoa ganha numa venda de cada preço. */
export function earningExamples(rule: CommissionRule, prices: readonly Cents[] = EXAMPLE_PRICES): EarningExample[] {
  return prices.map((price) => ({ price, commission: commissionCents(rule, price) }));
}

/** Preço da conta de exemplo do incentivo e da conta por mês da página "Seja afiliado". */
export const EXAMPLE_ACCOUNT_PRICE: Cents = 150_000;

/** "A cada 10 vendas você recebe R$ 450": a comissão da conta de exemplo vezes as vendas. */
export const incentiveEarning = (rule: CommissionRule, sales: number): Cents => commissionCents(rule, EXAMPLE_ACCOUNT_PRICE) * Math.max(0, sales);

/** Quanto rende por mês vendendo `sales` contas de `price`. */
export const monthlyEarning = (rule: CommissionRule, price: Cents, sales: number): Cents => commissionCents(rule, price) * Math.max(0, sales);

/** Frase curta para a regra: "3% de uma conta de R$ 1.500,00 = R$ 45,00". */
export function earningSentence(rule: CommissionRule, example: EarningExample): string {
  const how = rule.kind === "percent" ? `${rule.value}% de uma conta de ${formatBRL(example.price)}` : `Numa conta de ${formatBRL(example.price)}`;
  return `${how} = ${formatBRL(example.commission)} para você`;
}

/** As contas que mais rendem para divulgar: preço mais alto primeiro. */
export function topEarningAccounts<A extends { id: string; price: Cents }>(accounts: readonly A[], commissions: ReadonlyMap<string, Cents>, limit = 3): { account: A; commission: Cents }[] {
  return accounts
    .filter((account) => commissions.has(account.id))
    .map((account) => ({ account, commission: commissions.get(account.id) ?? 0 }))
    .sort((a, b) => b.commission - a.commission)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Indicação pelo WhatsApp
// ---------------------------------------------------------------------------

/** Caminho do link de WhatsApp do afiliado: conta o clique e abre o WhatsApp da loja com o código na mensagem. */
export const affiliateWhatsAppPath = (code: string) => `/indicacao/${encodeURIComponent(code)}`;

export const affiliateWhatsAppLink = (origin: string, code: string) => `${origin.replace(/\/$/, "")}${affiliateWhatsAppPath(code)}`;

/** Mensagem que o cliente manda. O "código: x" é o que o sistema lê na conversa para saber quem indicou. */
export const affiliateWhatsAppMessage = (code: string) => `Olá! Vim por indicação e quero ver as contas disponíveis (código: ${code}).`;

export interface AffiliateWhatsAppLead {
  affiliateId: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Números da loja para o painel
// ---------------------------------------------------------------------------

export interface AffiliateStoreStats {
  approvedAffiliates: number;
  /** Contas vendidas nos últimos 30 dias (para o "mais vendidos" por tipo). */
  soldAccountIds: string[];
}

export const STORE_STATS_DAYS = 30;

export const ASSIGN_ORDER_ERRORS = ["affiliate_not_approved", "order_not_found", "order_has_affiliate", "order_canceled"] as const;
export type AssignOrderError = (typeof ASSIGN_ORDER_ERRORS)[number];

export const ASSIGN_ORDER_MESSAGE: Record<AssignOrderError, string> = {
  affiliate_not_approved: "Esse afiliado não está aprovado.",
  order_not_found: "Não achamos esse pedido. Confira o código (ex.: JD-ABC123).",
  order_has_affiliate: "Esse pedido já conta para um afiliado.",
  order_canceled: "Esse pedido foi cancelado.",
};

export const assignOrderErrorOf = (message: string): AssignOrderError | null => ASSIGN_ORDER_ERRORS.find((code) => message.includes(code)) ?? null;
