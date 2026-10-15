import type { Cents } from "./money";
import type { Order } from "./order";

/** Cliente cadastrado à mão pelo Jota (comprou por fora do site, veio do CRM, etc.). */
export interface CustomerRecordData {
  name: string;
  email: string | null;
  /** Só dígitos, com DDD (o DDI 55 é opcional). */
  whatsapp: string | null;
  instagram: string | null;
  notes: string | null;
}

export interface CustomerRecord extends CustomerRecordData {
  id: string;
  createdAt: string;
}

/**
 * Visão de um cliente: junta o cadastro manual com os pedidos do site.
 * O e-mail liga os dois; cadastro sem e-mail fica sozinho.
 */
export interface CustomerSummary {
  key: string;
  name: string;
  email: string | null;
  whatsapp: string | null;
  instagram: string | null;
  notes: string | null;
  record: CustomerRecord | null;
  /** Do mais recente para o mais antigo. */
  orders: Order[];
  /** Pedidos pagos ou entregues. */
  purchases: number;
  totalSpent: Cents;
  openOrders: number;
  /** Primeiro pedido ou data do cadastro, o que vier antes. */
  since: string;
  lastOrderAt: string | null;
}

const isPurchase = (order: Order) => order.status === "paid" || order.status === "delivered";

export const customerKeyOf = (email: string) => email.trim().toLowerCase();

export const recordKeyOf = (record: Pick<CustomerRecord, "id" | "email">) =>
  record.email ? customerKeyOf(record.email) : `id:${record.id}`;

function summarize(key: string, orders: Order[], record: CustomerRecord | null): CustomerSummary {
  const sorted = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const latest = sorted[0];
  const purchases = sorted.filter(isPurchase);
  const firstOrderAt = sorted.at(-1)?.createdAt;
  const since = [firstOrderAt, record?.createdAt].filter((date): date is string => Boolean(date)).sort()[0] ?? "";
  return {
    key,
    name: record?.name ?? latest?.customer.name ?? "",
    email: record?.email ?? latest?.customer.email ?? null,
    whatsapp: record?.whatsapp ?? sorted.find((order) => order.customer.whatsapp)?.customer.whatsapp ?? null,
    instagram: record?.instagram ?? null,
    notes: record?.notes ?? null,
    record,
    orders: sorted,
    purchases: purchases.length,
    totalSpent: purchases.reduce((sum, order) => sum + order.total, 0),
    openOrders: sorted.filter((order) => order.status === "awaiting_payment").length,
    since,
    lastOrderAt: latest?.createdAt ?? null,
  };
}

const lastActivity = (customer: CustomerSummary) => customer.lastOrderAt ?? customer.since;

/** Agrupa pedidos e cadastros por cliente; quem teve movimento mais recente aparece primeiro. */
export function groupCustomers(orders: readonly Order[], records: readonly CustomerRecord[] = []): CustomerSummary[] {
  const ordersByKey = new Map<string, Order[]>();
  for (const order of orders) {
    const key = customerKeyOf(order.customer.email);
    ordersByKey.set(key, [...(ordersByKey.get(key) ?? []), order]);
  }
  const recordsByKey = new Map(records.map((record) => [recordKeyOf(record), record]));
  const keys = new Set([...ordersByKey.keys(), ...recordsByKey.keys()]);
  return [...keys]
    .map((key) => summarize(key, ordersByKey.get(key) ?? [], recordsByKey.get(key) ?? null))
    .sort((a, b) => lastActivity(b).localeCompare(lastActivity(a)));
}
