import type { Cents } from "./money";

/** Mesmas regras da tabela `coupons` (supabase/migrations/20261120120000_coupons.sql). */
export const COUPON_KINDS = ["percent", "fixed"] as const;
export type CouponKind = (typeof COUPON_KINDS)[number];

export const COUPON_KIND_LABEL: Record<CouponKind, string> = {
  percent: "Porcentagem",
  fixed: "Valor fixo",
};

export const COUPON_CODE_PATTERN = /^[A-Z0-9_-]{3,30}$/;
export const MAX_COUPON_PERCENT = 90;
export const MIN_COUPON_FIXED_CENTS = 100;
export const MAX_COUPON_FIXED_CENTS = 10_000_000;
/** O pedido nunca fica abaixo disso: é o mínimo de cada parte no pagamento dividido. */
export const COUPON_MIN_TOTAL_CENTS = 500;

/** O que o cliente digita vira o código do cupom: sem espaços nas pontas e em maiúsculas. */
export const normalizeCouponCode = (raw: string): string => raw.trim().toUpperCase();

export interface CouponData {
  code: string;
  kind: CouponKind;
  /** Porcentagem (1 a 90) ou centavos, conforme o tipo. */
  value: number;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  /** Nulo = sem limite. */
  maxUses: number | null;
  notes: string | null;
}

export interface Coupon extends CouponData {
  id: string;
  /** Pedidos com o cupom que não foram cancelados. */
  uses: number;
  createdAt: string;
}

/** Desconto do cupom num preço, igual ao banco: arredonda a porcentagem e para em R$ 5,00 de total. */
export function couponDiscount(coupon: Pick<CouponData, "kind" | "value">, price: Cents): Cents {
  const raw = coupon.kind === "percent" ? Math.round((price * coupon.value) / 100) : coupon.value;
  return Math.max(0, Math.min(raw, price - COUPON_MIN_TOTAL_CENTS));
}

/**
 * Reparte o desconto do carrinho pelo preço de cada conta, igual à `place_cart_order` no banco.
 * O primeiro preço é o do pedido principal (a conta mais cara) e fica com o arredondamento.
 */
export function splitCouponDiscount(prices: readonly Cents[], discount: Cents): Cents[] {
  const subtotal = prices.reduce((sum, price) => sum + price, 0);
  if (subtotal === 0 || discount === 0) return prices.map(() => 0);
  const shares = prices.map((price, index) => (index === 0 ? 0 : Math.floor((price * discount) / subtotal)));
  shares[0] = discount - shares.reduce((sum, share) => sum + share, 0);
  return shares;
}

export const COUPON_STATUSES = ["active", "inactive", "scheduled", "expired", "exhausted"] as const;
export type CouponStatus = (typeof COUPON_STATUSES)[number];

export const COUPON_STATUS_LABEL: Record<CouponStatus, string> = {
  active: "Valendo",
  inactive: "Desativado",
  scheduled: "Agendado",
  expired: "Vencido",
  exhausted: "Esgotado",
};

/** Situação do cupom agora, na mesma ordem de conferência do banco. */
export function couponStatusOf(coupon: Pick<Coupon, "active" | "startsAt" | "endsAt" | "maxUses" | "uses">, now = new Date()): CouponStatus {
  if (!coupon.active) return "inactive";
  if (coupon.startsAt && now < new Date(coupon.startsAt)) return "scheduled";
  if (coupon.endsAt && now >= new Date(coupon.endsAt)) return "expired";
  if (coupon.maxUses !== null && coupon.uses >= coupon.maxUses) return "exhausted";
  return "active";
}

/** Como o cupom aparece para o Jota: "10%" ou "R$ 50,00". */
export function couponValueLabel(coupon: Pick<CouponData, "kind" | "value">, formatMoney: (cents: Cents) => string): string {
  return coupon.kind === "percent" ? `${coupon.value}%` : formatMoney(coupon.value);
}

/** Prévia do checkout: o desconto que o banco confirmou para aquela conta. */
export interface CouponPreview {
  code: string;
  discount: Cents;
  total: Cents;
}

/** Motivos de recusa que o banco devolve (`raise exception` ou `{"error": ...}`). */
export const COUPON_REJECTIONS = [
  "coupon_not_found",
  "coupon_inactive",
  "coupon_not_started",
  "coupon_expired",
  "coupon_exhausted",
  "too_many_attempts",
  "account_unavailable",
] as const;
export type CouponRejection = (typeof COUPON_REJECTIONS)[number];

export const COUPON_REJECTION_MESSAGE: Record<CouponRejection, string> = {
  coupon_not_found: "Cupom não encontrado. Confira se digitou certo.",
  coupon_inactive: "Este cupom não está mais ativo.",
  coupon_not_started: "Este cupom ainda não começou a valer.",
  coupon_expired: "Este cupom venceu.",
  coupon_exhausted: "Este cupom já atingiu o limite de usos.",
  too_many_attempts: "Muitas tentativas de cupom. Espere um pouco e tente de novo.",
  account_unavailable: "Esta conta não está mais disponível.",
};

export const couponRejectionOf = (message: string): CouponRejection | null =>
  COUPON_REJECTIONS.find((reason) => message.includes(reason)) ?? null;
