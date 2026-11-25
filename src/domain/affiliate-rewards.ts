import { commissionCents, type AffiliateAnnouncement, type AffiliateCommission, type CommissionRule } from "./affiliate";
import { formatBRL, type Cents } from "./money";

/**
 * Entrega 2 dos afiliados: pagamento em lotes, brindes, avisos do painel e exemplos de ganho.
 * Mesmas regras de supabase/migrations/20270101120000_affiliates_v2.sql.
 */

// ---------------------------------------------------------------------------
// Pagamento em lotes ("pago a cada 10 indicações")
// ---------------------------------------------------------------------------

export interface AffiliatePayout {
  id: string;
  affiliateId: string;
  commissionsCount: number;
  amount: Cents;
  pixKey: string | null;
  note: string | null;
  paidAt: string;
}

export const MIN_PAYOUT_BATCH = 1;
export const MAX_PAYOUT_BATCH = 100;

export interface PayoutProgress {
  batchSize: number;
  /** Indicações já pagas. */
  paidCount: number;
  paidAmount: Cents;
  /** Indicações válidas esperando pagamento (na garantia ou já liberadas). */
  waiting: AffiliateCommission[];
  waitingAmount: Cents;
  /** Lotes completos prontos para pagar. */
  readyBatches: number;
  /** Quantas já contam para o próximo lote (de 0 a batchSize - 1). */
  inCurrentBatch: number;
  /** Quantas faltam para fechar o próximo lote. */
  missingForNextBatch: number;
  /** As indicações do próximo lote a pagar, das mais antigas para as mais novas. */
  nextBatch: AffiliateCommission[];
  nextBatchAmount: Cents;
  /** Do próximo lote, quantas ainda estão na garantia (o Jota pode esperar ou pagar assim mesmo). */
  nextBatchInGuarantee: number;
}

const byOldest = (a: AffiliateCommission, b: AffiliateCommission) => a.createdAt.localeCompare(b.createdAt);
const sumAmounts = (items: readonly AffiliateCommission[]) => items.reduce((total, item) => total + item.amount, 0);

export function payoutProgressOf(commissions: readonly AffiliateCommission[], batchSize: number, now: Date = new Date()): PayoutProgress {
  const size = Math.min(MAX_PAYOUT_BATCH, Math.max(MIN_PAYOUT_BATCH, Math.round(batchSize)));
  const paid = commissions.filter((commission) => commission.status === "paid");
  const waiting = commissions.filter((commission) => commission.status === "pending").sort(byOldest);
  const nextBatch = waiting.slice(0, size);
  const inCurrentBatch = waiting.length % size;
  return {
    batchSize: size,
    paidCount: paid.length,
    paidAmount: sumAmounts(paid),
    waiting,
    waitingAmount: sumAmounts(waiting),
    readyBatches: Math.floor(waiting.length / size),
    inCurrentBatch,
    missingForNextBatch: size - inCurrentBatch,
    nextBatch,
    nextBatchAmount: sumAmounts(nextBatch),
    nextBatchInGuarantee: nextBatch.filter((commission) => commission.releaseAt === null || new Date(commission.releaseAt) > now).length,
  };
}

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
        body: `A garantia de ${accountName(commission)} acabou: ${formatBRL(commission.amount)} entram no próximo pagamento.`,
        at: commission.releaseAt,
      });
    }
  }
  for (const payout of sources.payouts) {
    notices.push({
      id: `payout:${payout.id}`,
      kind: "payout",
      title: "Pagamento enviado",
      body: `A loja pagou ${formatBRL(payout.amount)} de ${payout.commissionsCount} ${payout.commissionsCount === 1 ? "indicação" : "indicações"}.`,
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
