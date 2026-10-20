import type { BrazilState } from "./brazil";
import type { Cents } from "./money";
import type { Platform } from "./platform";

export const PAYMENT_METHODS = ["pix", "card"] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const ORDER_STATUSES = ["awaiting_payment", "paid", "delivered", "canceled"] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * Ficha preenchida no checkout. Pedidos de antes da ficha completa (e a página pública do pedido,
 * que nunca devolve dado pessoal) chegam com esses campos vazios.
 */
export interface Customer {
  name: string;
  email: string;
  whatsapp: string | null;
  /** CPF ou CNPJ, só números. */
  document: string | null;
  /** AAAA-MM-DD */
  birthDate: string | null;
  instagram: string | null;
  city: string | null;
  state: BrazilState | null;
}

export interface Order {
  code: string;
  accountId: string | null;
  accountHandle: string;
  accountName: string;
  accountPlatform: Platform;
  customer: Customer;
  paymentMethod: PaymentMethod;
  total: Cents;
  status: OrderStatus;
  /** Até quando a conta fica reservada esperando o pagamento. */
  expiresAt: string;
  createdAt: string;
  /** Quando o pedido foi marcado como entregue; a garantia conta daqui. */
  deliveredAt: string | null;
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

export function generateOrderCode(random: () => number = Math.random): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const chars = Array.from({ length: 6 }, () => alphabet[Math.floor(random() * alphabet.length)]);
  return `JD-${chars.join("")}`;
}

export function maskEmail(email: string): string {
  const [user = "", domain = ""] = email.split("@");
  return `${user.slice(0, 2)}***@${domain}`;
}
