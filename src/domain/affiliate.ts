import type { Cents } from "./money";

/**
 * Programa de afiliados (Aditivo 01). Mesmas regras de supabase/migrations/20261216120000_affiliates.sql.
 * Comissão em nível único, só sobre venda paga, liberada depois da garantia.
 */

export const AFFILIATE_STATUSES = ["pending", "approved", "rejected", "suspended", "blocked"] as const;
export type AffiliateStatus = (typeof AFFILIATE_STATUSES)[number];

export const AFFILIATE_STATUS_LABEL: Record<AffiliateStatus, string> = {
  pending: "Esperando aprovação",
  approved: "Aprovado",
  rejected: "Recusado",
  suspended: "Suspenso",
  blocked: "Bloqueado",
};

/** O que cada situação significa para o afiliado, no painel dele. */
export const AFFILIATE_STATUS_MESSAGE: Record<Exclude<AffiliateStatus, "approved">, string> = {
  pending: "Seu cadastro chegou e está em análise. Assim que for aprovado, seus links e a vitrine aparecem aqui.",
  rejected: "Seu cadastro não foi aprovado. Se achar que foi engano, fale com a loja pelo WhatsApp.",
  suspended: "Sua conta de afiliado está suspensa no momento. Seus links não contam vendas enquanto isso.",
  blocked: "Sua conta de afiliado foi bloqueada. Fale com a loja se precisar de ajuda.",
};

export const COMMISSION_KINDS = ["percent", "fixed"] as const;
export type CommissionKind = (typeof COMMISSION_KINDS)[number];

export const COMMISSION_KIND_LABEL: Record<CommissionKind, string> = {
  percent: "Porcentagem da venda",
  fixed: "Valor fixo por venda",
};

export const MAX_COMMISSION_PERCENT = 90;
export const MIN_FIXED_COMMISSION_CENTS = 100;
export const MAX_FIXED_COMMISSION_CENTS = 10_000_000;

export interface CommissionRule {
  kind: CommissionKind;
  /** Porcentagem (1 a 90) ou centavos. */
  value: number;
}

/** Igual a `affiliate_commission_cents` no banco: arredonda a porcentagem e nunca passa do valor pago. */
export function commissionCents(rule: CommissionRule, base: Cents): Cents {
  const raw = rule.kind === "percent" ? Math.round((base * rule.value) / 100) : rule.value;
  return Math.max(0, Math.min(raw, base));
}

export function commissionRuleLabel(rule: CommissionRule, formatMoney: (cents: Cents) => string): string {
  return rule.kind === "percent" ? `${rule.value}% por venda` : `${formatMoney(rule.value)} por venda`;
}

export interface AffiliateProgramData {
  enabled: boolean;
  autoApprove: boolean;
  commission: CommissionRule;
  /** Por quantos dias o clique no link vale. */
  linkDays: number;
  minWithdrawal: Cents;
  dailyAutoLimit: Cents;
  manualApprovalAbove: Cents;
  terms: string;
  welcomeText: string | null;
  /** O Jota paga a cada tantas indicações (padrão 10). */
  payoutBatchSize: number;
  /** Faixa de chamada no topo do painel do afiliado. */
  bannerTitle: string | null;
  bannerText: string | null;
}

export interface AffiliateProgram extends AffiliateProgramData {
  updatedAt: string;
}

export const DEFAULT_AFFILIATE_PROGRAM: AffiliateProgram = {
  enabled: false,
  autoApprove: false,
  commission: { kind: "percent", value: 10 },
  linkDays: 30,
  minWithdrawal: 5000,
  dailyAutoLimit: 50000,
  manualApprovalAbove: 20000,
  terms: "",
  welcomeText: null,
  payoutBatchSize: 10,
  bannerTitle: null,
  bannerText: null,
  updatedAt: new Date(0).toISOString(),
};

/** Afiliado como o Jota vê na aba Parceiros. O CPF só vem aberto quando pedido (`documentOf`). */
export interface Affiliate {
  id: string;
  code: string;
  name: string;
  email: string;
  whatsapp: string | null;
  pixKey: string | null;
  status: AffiliateStatus;
  statusNote: string | null;
  partnerId: string | null;
  /** Comissão própria do afiliado. Nula = vale a padrão do programa. */
  commission: CommissionRule | null;
  /** Até quando ele já viu os avisos do painel. */
  notificationsSeenAt: string | null;
  termsAcceptedAt: string;
  approvedAt: string | null;
  createdAt: string;
}

export interface AffiliateStatusChange {
  status: AffiliateStatus;
  statusNote: string | null;
}

/** O que o próprio afiliado vê de si. */
export interface AffiliateMe extends Affiliate {
  coupon: AffiliateCoupon | null;
}

export interface AffiliateCoupon {
  code: string;
  kind: CommissionKind;
  value: number;
}

export const COMMISSION_VIAS = ["link", "coupon", "whatsapp", "manual"] as const;
export type CommissionVia = (typeof COMMISSION_VIAS)[number];

export const COMMISSION_VIA_LABEL: Record<CommissionVia, string> = {
  link: "Link",
  coupon: "Cupom",
  whatsapp: "WhatsApp",
  manual: "Indicação",
};

export const COMMISSION_CANCEL_REASONS = ["order_canceled", "self_purchase", "manual"] as const;
export type CommissionCancelReason = (typeof COMMISSION_CANCEL_REASONS)[number];

export const COMMISSION_CANCEL_REASON_LABEL: Record<CommissionCancelReason, string> = {
  order_canceled: "Pedido cancelado",
  self_purchase: "Compra do próprio afiliado",
  manual: "Cancelada pela loja",
};

export interface AffiliateCommission {
  id: string;
  affiliateId: string;
  orderCode: string;
  via: CommissionVia;
  accountHandle: string | null;
  accountPlatform: string | null;
  base: Cents;
  amount: Cents;
  status: "pending" | "canceled" | "paid";
  /** Fim da garantia. Nulo enquanto o pedido não foi entregue. */
  releaseAt: string | null;
  canceledReason: CommissionCancelReason | null;
  /** Lote em que foi paga. */
  payoutId: string | null;
  createdAt: string;
}

/** Situação que aparece na tela: "pendente" vira "liberada" quando a garantia acaba. */
export const COMMISSION_STATES = ["pending", "released", "paid", "canceled"] as const;
export type CommissionState = (typeof COMMISSION_STATES)[number];

export const COMMISSION_STATE_LABEL: Record<CommissionState, string> = {
  pending: "Pendente",
  released: "Liberada",
  paid: "Paga",
  canceled: "Cancelada",
};

export function commissionStateOf(commission: Pick<AffiliateCommission, "status" | "releaseAt">, now: Date = new Date()): CommissionState {
  if (commission.status !== "pending") return commission.status;
  return commission.releaseAt !== null && new Date(commission.releaseAt) <= now ? "released" : "pending";
}

export interface CommissionTotals {
  /** Vendas que geraram comissão (canceladas não contam). */
  sales: number;
  pending: Cents;
  released: Cents;
  paid: Cents;
  canceled: Cents;
  /** O que dá para sacar agora. Com os saques, desconta o que já foi pedido. */
  balance: Cents;
}

export function summarizeCommissions(commissions: readonly AffiliateCommission[], now: Date = new Date()): CommissionTotals {
  const totals: CommissionTotals = { sales: 0, pending: 0, released: 0, paid: 0, canceled: 0, balance: 0 };
  for (const commission of commissions) {
    const state = commissionStateOf(commission, now);
    totals[state] += commission.amount;
    if (state !== "canceled") totals.sales += 1;
  }
  totals.balance = totals.released;
  return totals;
}

export interface AffiliateClick {
  affiliateId: string;
  accountId: string | null;
  createdAt: string;
}

/** Vendas por clique, em %. Sem clique, não há taxa. */
export function conversionRate(sales: number, clicks: number): number | null {
  return clicks === 0 ? null : Math.round((sales / clicks) * 1000) / 10;
}

export interface AffiliateAnnouncementData {
  title: string;
  body: string;
  pinned: boolean;
}

export interface AffiliateAnnouncement extends AffiliateAnnouncementData {
  id: string;
  createdAt: string;
}

/** Fixados primeiro, depois os mais novos. */
export function sortAnnouncements<T extends Pick<AffiliateAnnouncement, "pinned" | "createdAt">>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt));
}

export interface RankingEntry {
  rank: number;
  displayName: string;
  sales: number;
  isMe: boolean;
}

/** Comissão de cada conta liberada para o afiliado, no preço atual. */
export type AccountCommissions = ReadonlyMap<string, Cents>;

/**
 * Comissão de uma venda, igual a `affiliate_amount_for` no banco: a comissão própria do afiliado entra no lugar da
 * padrão do programa; conta com comissão própria vale a da conta, a não ser que a do afiliado dê mais.
 */
export function affiliateAmountFor(
  program: CommissionRule,
  affiliate: CommissionRule | null,
  account: CommissionRule | null,
  base: Cents,
): Cents {
  const own = affiliate ? commissionCents(affiliate, base) : null;
  const ofAccount = account ? commissionCents(account, base) : null;
  if (own !== null && ofAccount !== null) return Math.max(own, ofAccount);
  return ofAccount ?? own ?? commissionCents(program, base);
}

/** Regra própria de uma conta. Nula = vale a comissão padrão do programa. */
export interface AccountAffiliateRule {
  enabled: boolean;
  commission: CommissionRule | null;
}

export const DEFAULT_ACCOUNT_AFFILIATE_RULE: AccountAffiliateRule = { enabled: true, commission: null };

// ---------------------------------------------------------------------------
// Link de afiliado
// ---------------------------------------------------------------------------

/** Parâmetro do link: jotadigitais.com.br/contas/minha-conta?ref=ana3f1. */
export const AFFILIATE_REF_PARAM = "ref";
export const AFFILIATE_CODE_PATTERN = /^[a-z0-9]{4,20}$/;

export function affiliateLink(origin: string, code: string, accountSlug: string | null = null): string {
  const path = accountSlug ? `/contas/${encodeURIComponent(accountSlug)}` : "/";
  return `${origin.replace(/\/$/, "")}${path}?${AFFILIATE_REF_PARAM}=${encodeURIComponent(code)}`;
}

/** Código que veio no link, já no formato do banco. Nulo se não for um código possível. */
export function parseAffiliateCode(raw: string | null): string | null {
  const code = (raw ?? "").trim().toLowerCase();
  return AFFILIATE_CODE_PATTERN.test(code) ? code : null;
}

/** "Ana Souza" vira "Ana S.", como no ranking. */
export function publicAffiliateName(name: string): string {
  const [first = "", second = ""] = name.trim().split(/\s+/);
  return second ? `${first} ${second.charAt(0).toUpperCase()}.` : first;
}

// ---------------------------------------------------------------------------
// Cadastro
// ---------------------------------------------------------------------------

export interface AffiliateSignup {
  name: string;
  email: string;
  password: string;
  whatsapp: string | null;
  document: string;
  termsSha256: string;
}

export const AFFILIATE_SIGNUP_ERRORS = [
  "program_closed",
  "outdated_terms",
  "too_many_attempts",
  "invalid_document",
  "document_taken",
  "email_taken",
  "invalid",
] as const;
export type AffiliateSignupError = (typeof AFFILIATE_SIGNUP_ERRORS)[number];

export const AFFILIATE_SIGNUP_MESSAGE: Record<AffiliateSignupError, string> = {
  program_closed: "O programa de afiliados não está aceitando cadastros agora.",
  outdated_terms: "Os termos do programa mudaram enquanto você preenchia. Recarregue a página e aceite a versão nova.",
  too_many_attempts: "Muitas tentativas de cadastro. Espere um pouco e tente de novo.",
  invalid_document: "Confira o CPF: ele precisa ser válido e estar no seu nome.",
  document_taken: "Já existe um afiliado com esse CPF. Se for você, entre com o seu e-mail.",
  email_taken: "Esse e-mail já tem cadastro. Entre com ele ou recupere a senha.",
  invalid: "Confira os dados do formulário.",
};

export const affiliateSignupErrorOf = (message: string): AffiliateSignupError | null =>
  AFFILIATE_SIGNUP_ERRORS.find((code) => message.includes(code)) ?? null;
