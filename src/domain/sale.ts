import type { Order } from "./order";

const DAY_MS = 86_400_000;

/** Venda finalizada: pedido entregue ao cliente. */
export const isFinalized = (order: Pick<Order, "status">) => order.status === "delivered";

/** Pedidos entregues antes de a data de entrega existir usam a data do pedido. */
export const deliveredAtOf = (order: Pick<Order, "deliveredAt" | "createdAt">) => order.deliveredAt ?? order.createdAt;

export interface Warranty {
  endsAt: Date;
  active: boolean;
  /** Dias inteiros que faltam, arredondando para cima; zero quando já acabou. */
  daysLeft: number;
}

/** A garantia conta a partir da entrega. */
export function warrantyOf(order: Pick<Order, "deliveredAt" | "createdAt">, guaranteeDays: number, now: Date = new Date()): Warranty {
  const endsAt = new Date(new Date(deliveredAtOf(order)).getTime() + guaranteeDays * DAY_MS);
  const remaining = endsAt.getTime() - now.getTime();
  return { endsAt, active: remaining > 0, daysLeft: Math.max(Math.ceil(remaining / DAY_MS), 0) };
}

/** Vendas finalizadas, da entrega mais recente para a mais antiga. */
export function finalizedSales(orders: readonly Order[]): Order[] {
  return orders.filter(isFinalized).sort((a, b) => deliveredAtOf(b).localeCompare(deliveredAtOf(a)));
}
