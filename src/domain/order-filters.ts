import { orderDateOf, type DateRange } from "./finance";
import type { Order } from "./order";
import type { PaymentPlan } from "./payment";

export type OrderSort = "newest" | "oldest" | "highest" | "lowest";

export const ORDER_SORT_LABEL: Record<OrderSort, string> = {
  newest: "Mais recentes",
  oldest: "Mais antigos",
  highest: "Maior valor",
  lowest: "Menor valor",
};

export type PaymentFilter = PaymentPlan | "all";

export interface OrderFilters {
  range: DateRange;
  payment: PaymentFilter;
}

export const isOrderInRange = (order: Pick<Order, "createdAt">, range: DateRange) => {
  const day = orderDateOf(order);
  return (range.from === null || day >= range.from) && day <= range.to;
};

export const matchesOrderFilters = (order: Order, { range, payment }: OrderFilters) =>
  isOrderInRange(order, range) && (payment === "all" || order.paymentMethod === payment);

const COMPARE: Record<OrderSort, (a: Order, b: Order) => number> = {
  newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
  oldest: (a, b) => a.createdAt.localeCompare(b.createdAt),
  highest: (a, b) => b.total - a.total || b.createdAt.localeCompare(a.createdAt),
  lowest: (a, b) => a.total - b.total || b.createdAt.localeCompare(a.createdAt),
};

export const sortOrders = (orders: readonly Order[], sort: OrderSort): Order[] => [...orders].sort(COMPARE[sort]);
