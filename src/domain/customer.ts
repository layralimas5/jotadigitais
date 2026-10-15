import type { Cents } from "./money";
import type { Order } from "./order";

/** Quem já fez pedido na loja, montado a partir dos pedidos (o e-mail identifica a pessoa). */
export interface CustomerSummary {
  key: string;
  name: string;
  email: string;
  whatsapp: string | null;
  /** Do mais recente para o mais antigo. */
  orders: Order[];
  /** Pedidos pagos ou entregues. */
  purchases: number;
  totalSpent: Cents;
  openOrders: number;
  firstOrderAt: string;
  lastOrderAt: string;
}

const isPurchase = (order: Order) => order.status === "paid" || order.status === "delivered";

export const customerKeyOf = (email: string) => email.trim().toLowerCase();

function summarize(orders: Order[]): CustomerSummary {
  const sorted = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const latest = sorted[0] as Order;
  const purchases = sorted.filter(isPurchase);
  return {
    key: customerKeyOf(latest.customer.email),
    name: latest.customer.name,
    email: latest.customer.email,
    whatsapp: sorted.find((order) => order.customer.whatsapp)?.customer.whatsapp ?? null,
    orders: sorted,
    purchases: purchases.length,
    totalSpent: purchases.reduce((sum, order) => sum + order.total, 0),
    openOrders: sorted.filter((order) => order.status === "awaiting_payment").length,
    firstOrderAt: (sorted.at(-1) as Order).createdAt,
    lastOrderAt: latest.createdAt,
  };
}

/** Agrupa os pedidos por cliente; quem comprou por último aparece primeiro. */
export function groupCustomers(orders: readonly Order[]): CustomerSummary[] {
  const byKey = new Map<string, Order[]>();
  for (const order of orders) {
    const key = customerKeyOf(order.customer.email);
    byKey.set(key, [...(byKey.get(key) ?? []), order]);
  }
  return [...byKey.values()].map(summarize).sort((a, b) => b.lastOrderAt.localeCompare(a.lastOrderAt));
}
