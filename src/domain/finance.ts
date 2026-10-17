import type { Cents } from "./money";
import { isReservationExpired, type Order, type PaymentMethod } from "./order";

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

/** Saída de dinheiro lançada pelo Jota. A entrada vem sozinha dos pedidos pagos. */
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

export interface FinanceSummary {
  revenue: Cents;
  expenses: Cents;
  profit: Cents;
  paidOrders: number;
  averageTicket: Cents;
  /** Pedidos aguardando pagamento com a reserva ainda valendo. */
  receivable: Cents;
  receivableOrders: number;
  byMethod: Record<PaymentMethod, Cents>;
  byCategory: { category: ExpenseCategory; amount: Cents }[];
  series: SeriesPoint[];
  granularity: "day" | "month";
}

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

/** Até dois meses, uma barra por dia; acima disso, uma por mês. */
function buildBuckets(range: DateRange, firstDate: string | null): { granularity: "day" | "month"; keys: string[] } {
  const from = range.from ?? firstDate ?? range.to;
  if (daysBetween(from, range.to) <= 62) {
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

function bucketLabel(key: string, granularity: "day" | "month"): string {
  const [year, month, day] = key.split("-");
  const monthName = MONTH_LABEL[Number(month) - 1] ?? month;
  return granularity === "day" ? `${Number(day)} ${monthName}` : `${monthName} ${year?.slice(2)}`;
}

/** Receita = pedidos pagos ou entregues, pela data do pedido. Despesas pela data lançada. */
export function summarizeFinance(orders: readonly Order[], expenses: readonly Expense[], range: DateRange, now: Date = new Date()): FinanceSummary {
  const paid = orders.filter((order) => isPaid(order) && inRange(orderDateOf(order), range));
  const spent = expenses.filter((expense) => inRange(expense.date, range));
  const pending = orders.filter((order) => order.status === "awaiting_payment" && !isReservationExpired(order, now));

  const revenue = paid.reduce((sum, order) => sum + order.total, 0);
  const expenseTotal = spent.reduce((sum, expense) => sum + expense.amount, 0);

  const byMethod: Record<PaymentMethod, Cents> = { pix: 0, card: 0 };
  for (const order of paid) byMethod[order.paymentMethod] += order.total;

  const categoryTotals = new Map<ExpenseCategory, Cents>();
  for (const expense of spent) categoryTotals.set(expense.category, (categoryTotals.get(expense.category) ?? 0) + expense.amount);

  const allDates = [...orders.filter(isPaid).map(orderDateOf), ...expenses.map((expense) => expense.date)].sort();
  const { granularity, keys } = buildBuckets(range, allDates[0] ?? null);
  const bucketOf = (date: string) => (granularity === "day" ? date : date.slice(0, 7));
  const points = new Map(keys.map((key) => [key, { key, label: bucketLabel(key, granularity), revenue: 0, expenses: 0 }]));
  for (const order of paid) {
    const point = points.get(bucketOf(orderDateOf(order)));
    if (point) point.revenue += order.total;
  }
  for (const expense of spent) {
    const point = points.get(bucketOf(expense.date));
    if (point) point.expenses += expense.amount;
  }

  return {
    revenue,
    expenses: expenseTotal,
    profit: revenue - expenseTotal,
    paidOrders: paid.length,
    averageTicket: paid.length ? Math.round(revenue / paid.length) : 0,
    receivable: pending.reduce((sum, order) => sum + order.total, 0),
    receivableOrders: pending.length,
    byMethod,
    byCategory: [...categoryTotals.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
    series: [...points.values()],
    granularity,
  };
}

export type Entry =
  | { kind: "revenue"; id: string; date: string; amount: Cents; order: Order }
  | { kind: "expense"; id: string; date: string; amount: Cents; expense: Expense };

/** Entradas e saídas do período, da mais recente para a mais antiga. */
export function entriesOf(orders: readonly Order[], expenses: readonly Expense[], range: DateRange): Entry[] {
  const revenues: Entry[] = orders
    .filter((order) => isPaid(order) && inRange(orderDateOf(order), range))
    .map((order) => ({ kind: "revenue", id: order.code, date: orderDateOf(order), amount: order.total, order }));
  const outflows: Entry[] = expenses
    .filter((expense) => inRange(expense.date, range))
    .map((expense) => ({ kind: "expense", id: expense.id, date: expense.date, amount: expense.amount, expense }));
  return [...revenues, ...outflows].sort((a, b) => b.date.localeCompare(a.date));
}
