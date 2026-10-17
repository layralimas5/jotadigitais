import { shopTierOf, type Account, type AccountOf } from "./account";
import { groupCustomers, type CustomerRecord } from "./customer";
import { dashboardRangeOf, previousRangeOf, type DashboardPeriod } from "./dashboard-period";
import { rangeOf, summarizeFinance, toLocalIsoDate, type DateRange, type Expense, type FinanceSummary } from "./finance";
import { followUpStatusOf, type Lead } from "./lead";
import type { Cents } from "./money";
import { isReservationExpired, type Order } from "./order";
import { summarizePartners, type Partner } from "./partner";
import { PLATFORMS, type Platform } from "./platform";
import { deliveredAtOf, finalizedSales } from "./sale";

export interface DashboardSource {
  orders: Order[];
  expenses: Expense[];
  accounts: Account[];
  leads: Lead[];
  partners: Partner[];
  customers: CustomerRecord[];
}

export interface StockByPlatform {
  platform: Platform;
  available: number;
  reserved: number;
}

/** Contas por situação: ativas na vitrine, reservadas por um pedido e já compradas. */
export interface AccountStatusCount {
  available: number;
  reserved: number;
  sold: number;
  total: number;
}

export interface TikTokMetrics {
  status: AccountStatusCount;
  /** Somas e médias das contas que ainda não foram vendidas. */
  followersInStock: number;
  averageFollowers: number;
  likesInStock: number;
  /** Com 2 mil seguidores ou mais o Shop está completo; abaixo disso, em modo piloto. */
  fullShop: number;
  pilotShop: number;
  averagePrice: Cents;
  salesInPeriod: number;
  revenueInPeriod: Cents;
}

export interface CustomerMetrics {
  total: number;
  /** Clientes com pelo menos um pedido pago ou entregue. */
  buyers: number;
  newInPeriod: number;
  /** Compraram duas vezes ou mais. */
  returning: number;
  withOpenOrders: number;
}

/**
 * Faturamento, vendas, clientes novos e comissão seguem o período escolhido no filtro.
 * Estoque, pendências e últimos pedidos são sempre a foto de agora.
 */
export interface Dashboard {
  period: FinanceSummary;
  /** Nulo quando não há com o que comparar (filtro "Tudo"). */
  previousPeriod: FinanceSummary | null;
  last30Days: FinanceSummary;
  last6Months: FinanceSummary;
  finalizedInPeriod: number;
  /** Pedidos com reserva valendo, esperando o Pix ou o cartão. */
  awaitingPayment: number;
  /** Pagos que ainda não foram entregues. */
  awaitingDelivery: number;
  /** Leads com retorno vencido ou marcado para hoje. */
  followUpsDue: number;
  /** Parte dos parceiros nas vendas finalizadas no período. */
  commissionInPeriod: Cents;
  accounts: AccountStatusCount;
  stock: StockByPlatform[];
  stockValue: Cents;
  tiktok: TikTokMetrics;
  customers: CustomerMetrics;
  recentOrders: Order[];
}

const RECENT_ORDERS = 5;
const CHART_MONTHS = 6;

const isPaid = (order: Order) => order.status === "paid" || order.status === "delivered";

const inRange = (day: string, range: DateRange) => (range.from === null || day >= range.from) && day <= range.to;

function countByStatus(accounts: readonly Account[]): AccountStatusCount {
  return {
    available: accounts.filter((account) => account.status === "available").length,
    reserved: accounts.filter((account) => account.status === "reserved").length,
    sold: accounts.filter((account) => account.status === "sold").length,
    total: accounts.length,
  };
}

const average = (values: readonly number[]) => (values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0);

const isTikTok = (account: Account): account is AccountOf<"tiktok"> => account.platform === "tiktok";

function tiktokMetrics(accounts: readonly Account[], orders: readonly Order[], range: DateRange): TikTokMetrics {
  const tiktok = accounts.filter(isTikTok);
  const inStock = tiktok.filter((account) => account.status !== "sold");
  const sales = orders.filter(
    (order) => order.accountPlatform === "tiktok" && isPaid(order) && inRange(toLocalIsoDate(new Date(order.createdAt)), range),
  );
  return {
    status: countByStatus(tiktok),
    followersInStock: inStock.reduce((sum, account) => sum + account.followers, 0),
    averageFollowers: average(inStock.map((account) => account.followers)),
    likesInStock: inStock.reduce((sum, account) => sum + account.stats.likes, 0),
    fullShop: inStock.filter((account) => shopTierOf(account) === "full").length,
    pilotShop: inStock.filter((account) => shopTierOf(account) === "pilot").length,
    averagePrice: average(tiktok.filter((account) => account.status === "available").map((account) => account.price)),
    salesInPeriod: sales.length,
    revenueInPeriod: sales.reduce((sum, order) => sum + order.total, 0),
  };
}

function customerMetrics(orders: readonly Order[], records: readonly CustomerRecord[], range: DateRange): CustomerMetrics {
  const customers = groupCustomers(orders, records);
  return {
    total: customers.length,
    buyers: customers.filter((customer) => customer.purchases > 0).length,
    newInPeriod: customers.filter((customer) => customer.since && inRange(toLocalIsoDate(new Date(customer.since)), range)).length,
    returning: customers.filter((customer) => customer.purchases >= 2).length,
    withOpenOrders: customers.filter((customer) => customer.openOrders > 0).length,
  };
}

/** Do primeiro dia de cinco meses atrás até hoje: seis barras mensais no gráfico. */
function lastMonthsRange(now: Date): DateRange {
  return { from: toLocalIsoDate(new Date(now.getFullYear(), now.getMonth() - (CHART_MONTHS - 1), 1)), to: toLocalIsoDate(now) };
}

export function buildDashboard(source: DashboardSource, period: DashboardPeriod, now: Date = new Date()): Dashboard {
  const { orders, expenses, accounts, leads, partners, customers } = source;
  const range = dashboardRangeOf(period, now);
  const previousRange = previousRangeOf(period, now);
  const today = toLocalIsoDate(now);
  const available = accounts.filter((account) => account.status === "available");
  const finalizedInPeriod = finalizedSales(orders).filter((order) => inRange(toLocalIsoDate(new Date(deliveredAtOf(order))), range));

  return {
    period: summarizeFinance(orders, expenses, range, now),
    previousPeriod: previousRange ? summarizeFinance(orders, expenses, previousRange, now) : null,
    last30Days: summarizeFinance(orders, expenses, rangeOf("last_30_days", now), now),
    last6Months: summarizeFinance(orders, expenses, lastMonthsRange(now), now),
    finalizedInPeriod: finalizedInPeriod.length,
    awaitingPayment: orders.filter((order) => order.status === "awaiting_payment" && !isReservationExpired(order, now)).length,
    awaitingDelivery: orders.filter((order) => order.status === "paid").length,
    followUpsDue: leads.filter((lead) => {
      const status = followUpStatusOf(lead, today);
      return status === "overdue" || status === "today";
    }).length,
    commissionInPeriod: summarizePartners(partners, accounts, finalizedInPeriod).reduce((sum, summary) => sum + summary.commission, 0),
    accounts: countByStatus(accounts),
    stock: PLATFORMS.map((platform) => ({
      platform,
      available: available.filter((account) => account.platform === platform).length,
      reserved: accounts.filter((account) => account.platform === platform && account.status === "reserved").length,
    })),
    stockValue: available.reduce((sum, account) => sum + account.price, 0),
    tiktok: tiktokMetrics(accounts, orders, range),
    customers: customerMetrics(orders, customers, range),
    recentOrders: [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, RECENT_ORDERS),
  };
}
