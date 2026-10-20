import type { Cents } from "./money";
import { isReservationExpired, type Order } from "./order";

export const EXPENSE_CATEGORIES = ["account_purchase", "ads", "tools", "fees", "other"] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  account_purchase: "Compra de conta",
  ads: "Anúncios",
  tools: "Ferramentas",
  fees: "Taxas",
  other: "Outros",
};

export const EXPENSE_PAYMENT_METHODS = ["pix", "card", "cash", "transfer", "boleto"] as const;
export type ExpensePaymentMethod = (typeof EXPENSE_PAYMENT_METHODS)[number];

export const EXPENSE_PAYMENT_METHOD_LABEL: Record<ExpensePaymentMethod, string> = {
  pix: "Pix",
  card: "Cartão",
  cash: "Dinheiro",
  transfer: "Transferência",
  boleto: "Boleto",
};

/** Saída de dinheiro lançada pelo Jota. */
export interface ExpenseData {
  description: string;
  category: ExpenseCategory;
  amount: Cents;
  /** AAAA-MM-DD */
  date: string;
  /** Para quem o dinheiro foi (vendedor da conta, plataforma de anúncio, ferramenta). */
  supplier: string | null;
  paymentMethod: ExpensePaymentMethod | null;
  /** Conta do estoque ligada à despesa, como na compra de uma conta. */
  accountId: string | null;
  notes: string | null;
}

export interface Expense extends ExpenseData {
  id: string;
  createdAt: string;
}

export const REVENUE_CATEGORIES = ["account_sale", "service", "commission", "other"] as const;
export type RevenueCategory = (typeof REVENUE_CATEGORIES)[number];

export const REVENUE_CATEGORY_LABEL: Record<RevenueCategory, string> = {
  account_sale: "Venda de conta",
  service: "Serviço",
  commission: "Comissão",
  other: "Outros",
};

/**
 * Entrada de dinheiro lançada à mão: venda fechada fora do site, serviço, comissão.
 * Os pedidos pagos do site entram sozinhos e não viram receita lançada.
 */
export interface RevenueData {
  description: string;
  category: RevenueCategory;
  amount: Cents;
  /** AAAA-MM-DD */
  date: string;
  paymentMethod: ExpensePaymentMethod | null;
  /** Cliente cadastrado à mão que pagou; a venda entra no histórico dele. */
  customerId: string | null;
  /** Conta do estoque vendida, quando for venda de conta. */
  accountId: string | null;
  notes: string | null;
}

export interface Revenue extends RevenueData {
  id: string;
  createdAt: string;
}

/** Tudo que o financeiro soma: pedidos do site, receitas lançadas e despesas. */
export interface FinanceSource {
  orders: readonly Order[];
  revenues: readonly Revenue[];
  expenses: readonly Expense[];
}

export const PERIOD_PRESETS = ["this_month", "last_month", "last_30_days", "this_year", "all"] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

export const PERIOD_LABEL: Record<PeriodPreset, string> = {
  this_month: "Este mês",
  last_month: "Mês passado",
  last_30_days: "Últimos 30 dias",
  this_year: "Este ano",
  all: "Tudo",
};

/** Datas inclusivas, AAAA-MM-DD. `from` nulo é desde o começo. */
export interface DateRange {
  from: string | null;
  to: string;
}

const pad = (value: number) => String(value).padStart(2, "0");

export const toLocalIsoDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Dia em que o pedido foi feito, no fuso de quem está olhando. */
export const orderDateOf = (order: Pick<Order, "createdAt">) => toLocalIsoDate(new Date(order.createdAt));

export function rangeOf(preset: PeriodPreset, now: Date = new Date()): DateRange {
  const today = toLocalIsoDate(now);
  const year = now.getFullYear();
  const month = now.getMonth();
  switch (preset) {
    case "this_month":
      return { from: toLocalIsoDate(new Date(year, month, 1)), to: today };
    case "last_month":
      return { from: toLocalIsoDate(new Date(year, month - 1, 1)), to: toLocalIsoDate(new Date(year, month, 0)) };
    case "last_30_days":
      return { from: toLocalIsoDate(new Date(year, month, now.getDate() - 29)), to: today };
    case "this_year":
      return { from: `${year}-01-01`, to: today };
    case "all":
      return { from: null, to: today };
  }
}

const inRange = (date: string, range: DateRange) => (range.from === null || date >= range.from) && date <= range.to;

const isPaid = (order: Order) => order.status === "paid" || order.status === "delivered";

export interface SeriesPoint {
  key: string;
  label: string;
  revenue: Cents;
  expenses: Cents;
}

/** De onde veio o dinheiro: pedidos do site ou uma categoria de receita lançada. */
export type RevenueOrigin = "site" | RevenueCategory;

export const REVENUE_ORIGIN_LABEL: Record<RevenueOrigin, string> = { site: "Pedidos do site", ...REVENUE_CATEGORY_LABEL };

export interface FinanceSummary {
  /** Pedidos pagos do site mais receitas lançadas. */
  revenue: Cents;
  expenses: Cents;
  profit: Cents;
  paidOrders: number;
  /** Quantas receitas lançadas à mão entraram no período. */
  manualRevenues: number;
  averageTicket: Cents;
  /** Pedidos aguardando pagamento com a reserva ainda valendo. */
  receivable: Cents;
  receivableOrders: number;
  byOrigin: { origin: RevenueOrigin; amount: Cents }[];
  byCategory: { category: ExpenseCategory; amount: Cents }[];
  series: SeriesPoint[];
  granularity: Granularity;
}

/** Como as barras do gráfico nascem: uma por dia ou uma por mês. */
export type Granularity = "day" | "month";

/** Como o gráfico mostra as barras: dá para juntar dias em semanas ou meses depois de calculados. */
export const SERIES_GROUPINGS = ["day", "week", "month"] as const;
export type SeriesGrouping = (typeof SERIES_GROUPINGS)[number];

const MONTH_LABEL = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  return toLocalIsoDate(new Date(year ?? 0, (month ?? 1) - 1, (day ?? 1) + days));
}

function daysBetween(from: string, to: string): number {
  const toTime = (iso: string) => {
    const [year, month, day] = iso.split("-").map(Number);
    return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1).getTime();
  };
  return Math.round((toTime(to) - toTime(from)) / 86_400_000);
}

/** Até dois meses, uma barra por dia; acima disso, uma por mês. `forced` escolhe na mão. */
function buildBuckets(range: DateRange, firstDate: string | null, forced?: Granularity): { granularity: Granularity; keys: string[] } {
  const from = range.from ?? firstDate ?? range.to;
  const daily = forced ? forced === "day" : daysBetween(from, range.to) <= 62;
  if (daily) {
    const keys: string[] = [];
    for (let day = from; day <= range.to; day = addDays(day, 1)) keys.push(day);
    return { granularity: "day", keys };
  }
  const keys: string[] = [];
  let [year, month] = from.split("-").map(Number) as [number, number];
  const [endYear, endMonth] = range.to.split("-").map(Number) as [number, number];
  while (year < endYear || (year === endYear && month <= endMonth)) {
    keys.push(`${year}-${pad(month)}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return { granularity: "month", keys };
}

function bucketLabel(key: string, granularity: Granularity): string {
  const [year, month, day] = key.split("-");
  const monthName = MONTH_LABEL[Number(month) - 1] ?? month;
  return granularity === "day" ? `${Number(day)} ${monthName}` : `${monthName} ${year?.slice(2)}`;
}

/** Receita = pedidos pagos ou entregues (pela data do pedido) mais receitas lançadas. Despesas pela data lançada. */
export function summarizeFinance(
  source: FinanceSource,
  range: DateRange,
  now: Date = new Date(),
  granularity?: Granularity,
): FinanceSummary {
  const { orders, revenues, expenses } = source;
  const paid = orders.filter((order) => isPaid(order) && inRange(orderDateOf(order), range));
  const received = revenues.filter((revenue) => inRange(revenue.date, range));
  const spent = expenses.filter((expense) => inRange(expense.date, range));
  const pending = orders.filter((order) => order.status === "awaiting_payment" && !isReservationExpired(order, now));

  const siteRevenue = paid.reduce((sum, order) => sum + order.total, 0);
  const revenue = siteRevenue + received.reduce((sum, item) => sum + item.amount, 0);
  const expenseTotal = spent.reduce((sum, expense) => sum + expense.amount, 0);

  const originTotals = new Map<RevenueOrigin, Cents>([["site", siteRevenue]]);
  for (const item of received) originTotals.set(item.category, (originTotals.get(item.category) ?? 0) + item.amount);

  const categoryTotals = new Map<ExpenseCategory, Cents>();
  for (const expense of spent) categoryTotals.set(expense.category, (categoryTotals.get(expense.category) ?? 0) + expense.amount);

  const allDates = [
    ...orders.filter(isPaid).map(orderDateOf),
    ...revenues.map((item) => item.date),
    ...expenses.map((expense) => expense.date),
  ].sort();
  const { granularity: bucketGranularity, keys } = buildBuckets(range, allDates[0] ?? null, granularity);
  const bucketOf = (date: string) => (bucketGranularity === "day" ? date : date.slice(0, 7));
  const points = new Map(keys.map((key) => [key, { key, label: bucketLabel(key, bucketGranularity), revenue: 0, expenses: 0 }]));
  const addRevenue = (date: string, amount: Cents) => {
    const point = points.get(bucketOf(date));
    if (point) point.revenue += amount;
  };
  for (const order of paid) addRevenue(orderDateOf(order), order.total);
  for (const item of received) addRevenue(item.date, item.amount);
  for (const expense of spent) {
    const point = points.get(bucketOf(expense.date));
    if (point) point.expenses += expense.amount;
  }

  return {
    revenue,
    expenses: expenseTotal,
    profit: revenue - expenseTotal,
    paidOrders: paid.length,
    manualRevenues: received.length,
    averageTicket: paid.length ? Math.round(siteRevenue / paid.length) : 0,
    receivable: pending.reduce((sum, order) => sum + order.total, 0),
    receivableOrders: pending.length,
    byOrigin: [...originTotals.entries()]
      .map(([origin, amount]) => ({ origin, amount }))
      .filter((row) => row.amount > 0)
      .sort((a, b) => b.amount - a.amount),
    byCategory: [...categoryTotals.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
    series: [...points.values()],
    granularity: bucketGranularity,
  };
}

/** Segunda-feira da semana do dia (AAAA-MM-DD). */
function weekStartOf(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  const value = new Date(year ?? 0, (month ?? 1) - 1, date ?? 1);
  value.setDate(value.getDate() - ((value.getDay() + 6) % 7));
  return toLocalIsoDate(value);
}

const groupKeyOf = (day: string, grouping: SeriesGrouping) => (grouping === "week" ? weekStartOf(day) : day.slice(0, 7));

const groupLabelOf = (key: string, grouping: SeriesGrouping) =>
  grouping === "week" ? `sem. ${bucketLabel(key, "day")}` : bucketLabel(key, "month");

/** Junta barras diárias em semanas (começando na segunda) ou meses. Série mensal volta como está. */
export function regroupSeries(series: readonly SeriesPoint[], grouping: SeriesGrouping): SeriesPoint[] {
  const daily = series.every((point) => point.key.length === 10);
  if (grouping === "day" || !daily) return [...series];
  const groups = new Map<string, SeriesPoint>();
  for (const point of series) {
    const key = groupKeyOf(point.key, grouping);
    const group = groups.get(key) ?? { key, label: groupLabelOf(key, grouping), revenue: 0, expenses: 0 };
    group.revenue += point.revenue;
    group.expenses += point.expenses;
    groups.set(key, group);
  }
  return [...groups.values()];
}

export type Entry =
  | { kind: "order"; id: string; date: string; amount: Cents; order: Order }
  | { kind: "revenue"; id: string; date: string; amount: Cents; revenue: Revenue }
  | { kind: "expense"; id: string; date: string; amount: Cents; expense: Expense };

export const isInflow = (entry: Entry) => entry.kind !== "expense";

/** Entradas (pedidos pagos e receitas lançadas) e saídas do período, da mais recente para a mais antiga. */
export function entriesOf(source: FinanceSource, range: DateRange): Entry[] {
  const orders: Entry[] = source.orders
    .filter((order) => isPaid(order) && inRange(orderDateOf(order), range))
    .map((order) => ({ kind: "order", id: order.code, date: orderDateOf(order), amount: order.total, order }));
  const revenues: Entry[] = source.revenues
    .filter((revenue) => inRange(revenue.date, range))
    .map((revenue) => ({ kind: "revenue", id: revenue.id, date: revenue.date, amount: revenue.amount, revenue }));
  const outflows: Entry[] = source.expenses
    .filter((expense) => inRange(expense.date, range))
    .map((expense) => ({ kind: "expense", id: expense.id, date: expense.date, amount: expense.amount, expense }));
  return [...orders, ...revenues, ...outflows].sort((a, b) => b.date.localeCompare(a.date));
}
