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
  /**
   * Quantas vendas entram no exemplo de ganho da página "Seja afiliado" ("a cada 10 vendas você recebe R$ X").
   * No banco é a coluna payout_batch_size: até a entrega 3 ela era o lote de pagamento, que deixou de existir
   * (toda comissão liberada pode ser paga). O nome da coluna ficou para não quebrar o site em cache.
   */
  incentiveSales: number;
  /** Faixa de chamada no topo do painel do afiliado. */
  bannerTitle: string | null;
  bannerText: string | null;
  /** Textos editáveis em Programa > Textos. Nulo = o texto padrão (AFFILIATE_TEXT_DEFAULTS). */
  texts: AffiliateProgramTexts;
}

/** Textos que o Jota troca na aba Programa. Aceitam marcadores como {vendas}, {valor} e {dias}. */
export interface AffiliateProgramTexts {
  /** Página "Seja afiliado": "A cada {vendas} vendas você recebe {valor} no total." */
  incentive: string | null;
  /** Página "Seja afiliado": como a comissão de cada venda é liberada ({dias}). */
  earnRule: string | null;
  /** Painel do afiliado, cartão de pagamento ({dias}). */
  payoutInfo: string | null;
  /** Aviso de que o saldo compra uma conta no site (painel e página "Seja afiliado"). */
  balanceNotice: string | null;
  /** Mensagem do WhatsApp que leva o convite ({nome}, {link}). */
  inviteMessage: string | null;
}

export type AffiliateTextKey = keyof AffiliateProgramTexts;

export const AFFILIATE_TEXT_DEFAULTS: Record<AffiliateTextKey, string> = {
  incentive: "A cada {vendas} vendas você recebe {valor} no total.",
  earnRule:
    "Você ganha em cada venda, sem precisar juntar um número mínimo. A comissão de cada venda fica liberada {dias} dias depois da entrega, quando a garantia da conta acaba, e aí você pede o pagamento por Pix quando quiser.",
  payoutInfo:
    "Cada venda fica liberada para receber {dias} dias depois da entrega, quando a garantia acaba. Com saldo liberado, peça o pagamento quando quiser.",
  balanceNotice: "Seu saldo liberado também compra conta no site: gere o código de saldo, use no checkout e pague só a diferença.",
  inviteMessage:
    "Oi, {nome}! Você foi convidado(a) para ser afiliado(a) da Jota Digitais e ganhar comissão em cada conta vendida. Faça o seu cadastro por este link: {link}",
};

export const AFFILIATE_TEXT_LIMITS: Record<AffiliateTextKey, number> = {
  incentive: 300,
  earnRule: 600,
  payoutInfo: 600,
  balanceNotice: 600,
  inviteMessage: 1000,
};

export const EMPTY_AFFILIATE_TEXTS: AffiliateProgramTexts = { incentive: null, earnRule: null, payoutInfo: null, balanceNotice: null, inviteMessage: null };

/** Texto do programa com os marcadores trocados: {vendas}, {valor}, {dias}, {nome}, {link}. */
export function affiliateText(texts: AffiliateProgramTexts, key: AffiliateTextKey, tokens: Readonly<Record<string, string | number>> = {}): string {
  const template = texts[key]?.trim() || AFFILIATE_TEXT_DEFAULTS[key];
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in tokens ? String(tokens[name]) : match));
}

export interface AffiliateProgram extends AffiliateProgramData {
  updatedAt: string;
}

export const DEFAULT_AFFILIATE_PROGRAM: AffiliateProgram = {
  enabled: false,
  autoApprove: false,
  commission: { kind: "percent", value: 10 },
  linkDays: 30,
  minWithdrawal: 100,
  dailyAutoLimit: 50000,
  manualApprovalAbove: 20000,
  terms: "",
  welcomeText: null,
  incentiveSales: 10,
  bannerTitle: null,
  bannerText: null,
  texts: EMPTY_AFFILIATE_TEXTS,
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
  /** Quando ele pediu o pagamento do saldo liberado. Nulo depois que o Jota paga. */
  payoutRequestedAt: string | null;
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
  /** Pagamento em que foi paga. */
  payoutId: string | null;
  /** Código de saldo em que está reservada (o afiliado vai usar o saldo numa compra). */
  balanceCouponId: string | null;
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
  /** Liberado, mas reservado num código de saldo para comprar uma conta. */
  reserved: Cents;
  /** O que dá para receber agora: liberado e fora de código de saldo. */
  balance: Cents;
}

export function summarizeCommissions(commissions: readonly AffiliateCommission[], now: Date = new Date()): CommissionTotals {
  const totals: CommissionTotals = { sales: 0, pending: 0, released: 0, paid: 0, canceled: 0, reserved: 0, balance: 0 };
  for (const commission of commissions) {
    const state = commissionStateOf(commission, now);
    totals[state] += commission.amount;
    if (state !== "canceled") totals.sales += 1;
    if (state === "released" && commission.balanceCouponId !== null) totals.reserved += commission.amount;
  }
  totals.balance = totals.released - totals.reserved;
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

/** O que decide a comissão de uma venda (ver affiliateAmountFor). */
export interface CommissionSources {
  program: CommissionRule;
  /** Comissão própria do afiliado. */
  affiliate: CommissionRule | null;
  /** Comissão própria da conta. */
  account: CommissionRule | null;
  /** Regra personalizada que casou com o afiliado e a conta (bestCommissionRule). */
  matchedRule: CommissionRule | null;
}

/**
 * Comissão de uma venda, igual a `affiliate_amount_for` no banco. Com regra que casa: o valor da regra, a não ser
 * que a comissão própria da conta dê mais. Sem regra: a comissão própria do afiliado entra no lugar da padrão do
 * programa; conta com comissão própria vale a da conta, a não ser que a do afiliado dê mais.
 */
export function affiliateAmountFor(sources: CommissionSources, base: Cents): Cents {
  const ofAccount = sources.account ? commissionCents(sources.account, base) : null;
  if (sources.matchedRule) return Math.max(commissionCents(sources.matchedRule, base), ofAccount ?? 0);
  const own = sources.affiliate ? commissionCents(sources.affiliate, base) : null;
  if (own !== null && ofAccount !== null) return Math.max(own, ofAccount);
  return ofAccount ?? own ?? commissionCents(sources.program, base);
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
  /** Código do convite (link /seja-afiliado?convite=...). Nulo no cadastro aberto. */
  inviteToken: string | null;
}

export const AFFILIATE_SIGNUP_ERRORS = [
  "program_closed",
  "outdated_terms",
  "too_many_attempts",
  "invalid_document",
  "document_taken",
  "email_taken",
  "invalid_invite",
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
  invalid_invite: "Esse convite não vale mais (já foi usado ou foi cancelado). Peça um link novo para a loja.",
  invalid: "Confira os dados do formulário.",
};

export const affiliateSignupErrorOf = (message: string): AffiliateSignupError | null =>
  AFFILIATE_SIGNUP_ERRORS.find((code) => message.includes(code)) ?? null;
