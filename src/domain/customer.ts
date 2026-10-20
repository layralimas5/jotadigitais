import type { BrazilState } from "./brazil";
import type { Revenue } from "./finance";
import type { LeadSource } from "./lead";
import type { Cents } from "./money";
import type { Order } from "./order";
import type { Platform } from "./platform";

export { BRAZIL_STATES, formatDocument, type BrazilState } from "./brazil";

/** Cliente cadastrado à mão pelo Jota (comprou por fora do site, veio do CRM, etc.). */
export interface CustomerRecordData {
  name: string;
  /** CPF (11 dígitos) ou CNPJ (14), só números. */
  document: string | null;
  /** AAAA-MM-DD */
  birthDate: string | null;
  email: string | null;
  /** Só dígitos, com DDD (o DDI 55 é opcional). */
  whatsapp: string | null;
  instagram: string | null;
  city: string | null;
  state: BrazilState | null;
  /** Por onde o cliente chegou até a loja. */
  source: LeadSource | null;
  /** Rede em que ele tem interesse em comprar conta. */
  interest: Platform | null;
  notes: string | null;
}

export interface CustomerRecord extends CustomerRecordData {
  id: string;
  createdAt: string;
}

/** Do site: comprou pelo checkout. Manual: só existe no cadastro do painel. */
export type CustomerOrigin = "site" | "manual";

/** Ficha mostrada no painel: a do cadastro manual ou, sem ele, a do último checkout que trouxe os dados. */
export interface CustomerSheet {
  document: string | null;
  birthDate: string | null;
  instagram: string | null;
  city: string | null;
  state: BrazilState | null;
}

/**
 * Visão de um cliente: junta o cadastro manual com os pedidos do site e as vendas lançadas por fora.
 * O e-mail liga cadastro e pedidos; cadastro sem e-mail fica sozinho.
 */
export interface CustomerSummary {
  key: string;
  origin: CustomerOrigin;
  name: string;
  email: string | null;
  whatsapp: string | null;
  instagram: string | null;
  notes: string | null;
  sheet: CustomerSheet;
  record: CustomerRecord | null;
  /** Do mais recente para o mais antigo. */
  orders: Order[];
  /** Receitas lançadas no Financeiro com este cliente, da mais recente para a mais antiga. */
  manualSales: Revenue[];
  /** Pedidos pagos ou entregues, mais as vendas lançadas por fora. */
  purchases: number;
  totalSpent: Cents;
  openOrders: number;
  /** Primeiro pedido ou data do cadastro, o que vier antes. */
  since: string;
  lastOrderAt: string | null;
  /** Último pedido pago ou venda lançada. */
  lastPurchaseAt: string | null;
}

const isPurchase = (order: Order) => order.status === "paid" || order.status === "delivered";

export const customerKeyOf = (email: string) => email.trim().toLowerCase();

export const recordKeyOf = (record: Pick<CustomerRecord, "id" | "email">) =>
  record.email ? customerKeyOf(record.email) : `id:${record.id}`;

const EMPTY_SHEET: CustomerSheet = { document: null, birthDate: null, instagram: null, city: null, state: null };

function sheetOf(record: CustomerRecord | null, orders: readonly Order[]): CustomerSheet {
  if (record) {
    const { document, birthDate, instagram, city, state } = record;
    return { document, birthDate, instagram, city, state };
  }
  const withSheet = orders.find((order) => order.customer.document);
  if (!withSheet) return EMPTY_SHEET;
  const { document, birthDate, instagram, city, state } = withSheet.customer;
  return { document, birthDate, instagram, city, state };
}

const latestDate = (dates: readonly (string | null | undefined)[]) =>
  dates.filter((date): date is string => Boolean(date)).sort().at(-1) ?? null;

function summarize(key: string, orders: Order[], record: CustomerRecord | null, sales: Revenue[]): CustomerSummary {
  const sorted = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const manualSales = [...sales].sort((a, b) => b.date.localeCompare(a.date));
  const latest = sorted[0];
  const purchases = sorted.filter(isPurchase);
  const firstOrderAt = sorted.at(-1)?.createdAt;
  const since = [firstOrderAt, record?.createdAt].filter((date): date is string => Boolean(date)).sort()[0] ?? "";
  const sheet = sheetOf(record, sorted);
  return {
    key,
    origin: sorted.length > 0 ? "site" : "manual",
    name: record?.name ?? latest?.customer.name ?? "",
    email: record?.email ?? latest?.customer.email ?? null,
    whatsapp: record?.whatsapp ?? sorted.find((order) => order.customer.whatsapp)?.customer.whatsapp ?? null,
    instagram: sheet.instagram,
    notes: record?.notes ?? null,
    sheet,
    record,
    orders: sorted,
    manualSales,
    purchases: purchases.length + manualSales.length,
    totalSpent:
      purchases.reduce((sum, order) => sum + order.total, 0) + manualSales.reduce((sum, sale) => sum + sale.amount, 0),
    openOrders: sorted.filter((order) => order.status === "awaiting_payment").length,
    since,
    lastOrderAt: latest?.createdAt ?? null,
    lastPurchaseAt: latestDate([purchases[0]?.createdAt, manualSales[0]?.date]),
  };
}

const lastActivity = (customer: CustomerSummary) => latestDate([customer.lastOrderAt, customer.lastPurchaseAt]) ?? customer.since;

/** Agrupa pedidos, cadastros e vendas lançadas por cliente; quem teve movimento mais recente aparece primeiro. */
export function groupCustomers(
  orders: readonly Order[],
  records: readonly CustomerRecord[] = [],
  revenues: readonly Revenue[] = [],
): CustomerSummary[] {
  const ordersByKey = new Map<string, Order[]>();
  for (const order of orders) {
    const key = customerKeyOf(order.customer.email);
    ordersByKey.set(key, [...(ordersByKey.get(key) ?? []), order]);
  }
  const recordsByKey = new Map(records.map((record) => [recordKeyOf(record), record]));
  const salesByRecord = new Map<string, Revenue[]>();
  for (const revenue of revenues) {
    if (!revenue.customerId) continue;
    salesByRecord.set(revenue.customerId, [...(salesByRecord.get(revenue.customerId) ?? []), revenue]);
  }
  const keys = new Set([...ordersByKey.keys(), ...recordsByKey.keys()]);
  return [...keys]
    .map((key) => {
      const record = recordsByKey.get(key) ?? null;
      return summarize(key, ordersByKey.get(key) ?? [], record, record ? (salesByRecord.get(record.id) ?? []) : []);
    })
    .sort((a, b) => lastActivity(b).localeCompare(lastActivity(a)));
}

export interface OriginCounts {
  all: number;
  site: number;
  manual: number;
}

export function countByOrigin(customers: readonly CustomerSummary[]): OriginCounts {
  const site = customers.filter((customer) => customer.origin === "site").length;
  return { all: customers.length, site, manual: customers.length - site };
}
