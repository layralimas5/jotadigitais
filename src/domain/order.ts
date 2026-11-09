import type { BrazilState } from "./brazil";
import type { LeadSource } from "./lead";
import type { Cents } from "./money";
import { PAYMENT_PLANS, type OrderPayment, type PaymentPlan } from "./payment";
import type { Platform } from "./platform";

/** Forma de pagamento do pedido inteiro. As divididas viram duas cobranças em `Order.payments`. */
export const PAYMENT_METHODS = PAYMENT_PLANS;

export type PaymentMethod = PaymentPlan;

export const ORDER_STATUSES = ["awaiting_payment", "paid", "delivered", "canceled"] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * Ficha preenchida no checkout. Pedidos de antes da ficha completa (e a página pública do pedido,
 * que nunca devolve dado pessoal) chegam com esses campos vazios.
 */
export interface Customer {
  name: string;
  /** Pedidos de antes do checkout sem e-mail. Os novos chegam sem. */
  email: string | null;
  whatsapp: string | null;
  /** CPF ou CNPJ, só números. */
  document: string | null;
  /** AAAA-MM-DD */
  birthDate: string | null;
  instagram: string | null;
  city: string | null;
  state: BrazilState | null;
  /** Como conheceu a loja. */
  source: LeadSource | null;
  /** Quem indicou, como o cliente escreveu. Só quando `source` é indicação. */
  referredBy: string | null;
}

/** Uma conta do carrinho, como a página pública do pedido mostra (sem dado pessoal). */
export interface OrderCartItem {
  code: string;
  accountHandle: string;
  accountName: string;
  accountPlatform: Platform;
  /** Já com a parte do desconto do cupom que coube a esta conta. */
  total: Cents;
  discount: Cents;
  status: OrderStatus;
}

export interface Order {
  code: string;
  accountId: string | null;
  accountHandle: string;
  accountName: string;
  accountPlatform: Platform;
  customer: Customer;
  paymentMethod: PaymentMethod;
  /** Já com o desconto do cupom. */
  total: Cents;
  /** Cupom usado no checkout; nulo sem cupom. */
  couponCode: string | null;
  /** Quanto o cupom tirou do preço da conta (0 sem cupom). */
  discount: Cents;
  status: OrderStatus;
  /** Até quando a conta fica reservada esperando o pagamento. */
  expiresAt: string;
  createdAt: string;
  /** Quando o pedido foi marcado como entregue; a garantia conta daqui. */
  deliveredAt: string | null;
  /** Cobranças do pedido, na ordem. Pedidos de antes do pagamento dividido chegam sem nenhuma. */
  payments: OrderPayment[];
  /**
   * Código do pedido principal quando a conta foi comprada num carrinho (no principal, é o próprio código).
   * O principal recebe as cobranças do carrinho inteiro; os outros acompanham o status dele.
   */
  cartCode: string | null;
  /** Contas do carrinho, o principal primeiro. Só a página pública do pedido principal recebe; nos outros casos, vazio. */
  cartItems: OrderCartItem[];
}

/** Mesmo limite da função `cart_max_items` no banco. */
export const MAX_CART_ITEMS = 10;

export const isCartLead = (order: Pick<Order, "code" | "cartCode">) => order.cartCode === order.code;

/** Pedido que faz parte de um carrinho mas não é o principal: o pagamento fica no principal. */
export const isCartMember = (order: Pick<Order, "code" | "cartCode">) => order.cartCode !== null && order.cartCode !== order.code;

/** Total e desconto que o cliente paga: o carrinho inteiro no pedido principal, a conta sozinha nos outros. */
export function chargedAmounts(order: Pick<Order, "total" | "discount" | "cartItems">): { total: Cents; discount: Cents } {
  if (order.cartItems.length === 0) return { total: order.total, discount: order.discount };
  return {
    total: order.cartItems.reduce((sum, item) => sum + item.total, 0),
    discount: order.cartItems.reduce((sum, item) => sum + item.discount, 0),
  };
}

export const MAX_CARD_INSTALLMENTS = 12;

/** Tempo que a conta fica segura para quem fez o pedido, até o pagamento ser confirmado. */
export const RESERVATION_HOLD_MINUTES = 120;

/** Mesmas regras do gatilho `sync_order_status` no banco. */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  awaiting_payment: ["paid", "canceled"],
  paid: ["delivered", "canceled"],
  delivered: [],
  canceled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

export function isReservationExpired(order: Pick<Order, "status" | "expiresAt">, now: Date = new Date()): boolean {
  return order.status === "awaiting_payment" && new Date(order.expiresAt).getTime() <= now.getTime();
}

/** Quem comprou a conta: o pedido mais recente dela que não foi cancelado. */
export function buyerOrderOf(orders: readonly Order[], accountId: string): Order | null {
  return (
    orders
      .filter((order) => order.accountId === accountId && order.status !== "canceled")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
  );
}

export function generateOrderCode(random: () => number = Math.random): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const chars = Array.from({ length: 6 }, () => alphabet[Math.floor(random() * alphabet.length)]);
  return `JD-${chars.join("")}`;
}

export function maskEmail(email: string): string {
  const [user = "", domain = ""] = email.split("@");
  return `${user.slice(0, 2)}***@${domain}`;
}
