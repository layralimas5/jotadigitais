import { shopTierOf, type Account, type AccountOf } from "./account";
import { groupCustomers, type CustomerRecord } from "./customer";
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
  salesThisMonth: number;
  revenueThisMonth: Cents;
}

export interface CustomerMetrics {
  total: number;
  /** Clientes com pelo menos um pedido pago ou entregue. */
  buyers: number;
  newThisMonth: number;
  /** Compraram duas vezes ou mais. */
  returning: number;
  withOpenOrders: number;
}

export interface Dashboard {
  month: FinanceSummary;
  previousMonth: FinanceSummary;
  last30Days: FinanceSummary;
  last6Months: FinanceSummary;
  finalizedThisMonth: number;
  /** Pedidos com reserva valendo, esperando o Pix ou o cartão. */
  awaitingPayment: number;
  /** Pagos que ainda não foram entregues. */
  awaitingDelivery: number;
  /** Leads com retorno vencido ou marcado para hoje. */
  followUpsDue: number;
  /** Parte dos parceiros nas vendas finalizadas este mês. */
  commissionThisMonth: Cents;
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

function tiktokMetrics(accounts: readonly Account[], orders: readonly Order[], month: DateRange): TikTokMetrics {
  const tiktok = accounts.filter(isTikTok);
  const inStock = tiktok.filter((account) => account.status !== "sold");
  const sales = orders.filter(
    (order) => order.accountPlatform === "tiktok" && isPaid(order) && inRange(toLocalIsoDate(new Date(order.createdAt)), month),
  );
  return {
    status: countByStatus(tiktok),
    followersInStock: inStock.reduce((sum, account) => sum + account.followers, 0),
    averageFollowers: average(inStock.map((account) => account.followers)),
    likesInStock: inStock.reduce((sum, account) => sum + account.stats.likes, 0),
    fullShop: inStock.filter((account) => shopTierOf(account) === "full").length,
    pilotShop: inStock.filter((account) => shopTierOf(account) === "pilot").length,
    averagePrice: average(tiktok.filter((account) => account.status === "available").map((account) => account.price)),
    salesThisMonth: sales.length,
    revenueThisMonth: sales.reduce((sum, order) => sum + order.total, 0),
  };
}

function customerMetrics(orders: readonly Order[], records: readonly CustomerRecord[], month: DateRange): CustomerMetrics {
  const customers = groupCustomers(orders, records);
  return {
    total: customers.length,
    buyers: customers.filter((customer) => customer.purchases > 0).length,
    newThisMonth: customers.filter((customer) => customer.since && inRange(toLocalIsoDate(new Date(customer.since)), month)).length,
    returning: customers.filter((customer) => customer.purchases >= 2).length,
    withOpenOrders: customers.filter((customer) => customer.openOrders > 0).length,
  };
}

/** Do primeiro dia de cinco meses atrás até hoje: seis barras mensais no gráfico. */
function lastMonthsRange(now: Date): DateRange {
  return { from: toLocalIsoDate(new Date(now.getFullYear(), now.getMonth() - (CHART_MONTHS - 1), 1)), to: toLocalIsoDate(now) };
}

export function buildDashboard(source: DashboardSource, now: Date = new Date()): Dashboard {
  const { orders, expenses, accounts, leads, partners, customers } = source;
  const month = rangeOf("this_month", now);
  const today = toLocalIsoDate(now);
  const available = accounts.filter((account) => account.status === "available");
  const finalizedThisMonth = finalizedSales(orders).filter((order) => inRange(toLocalIsoDate(new Date(deliveredAtOf(order))), month));

  return {
    month: summarizeFinance(orders, expenses, month, now),
    previousMonth: summarizeFinance(orders, expenses, rangeOf("last_month", now), now),
    last30Days: summarizeFinance(orders, expenses, rangeOf("last_30_days", now), now),
    last6Months: summarizeFinance(orders, expenses, lastMonthsRange(now), now),
    finalizedThisMonth: finalizedThisMonth.length,
    awaitingPayment: orders.filter((order) => order.status === "awaiting_payment" && !isReservationExpired(order, now)).length,
    awaitingDelivery: orders.filter((order) => order.status === "paid").length,
    followUpsDue: leads.filter((lead) => {
      const status = followUpStatusOf(lead, today);
      return status === "overdue" || status === "today";
    }).length,
    commissionThisMonth: summarizePartners(partners, accounts, finalizedThisMonth).reduce((sum, summary) => sum + summary.commission, 0),
    accounts: countByStatus(accounts),
    stock: PLATFORMS.map((platform) => ({
      platform,
      available: available.filter((account) => account.platform === platform).length,
      reserved: accounts.filter((account) => account.platform === platform && account.status === "reserved").length,
    })),
    stockValue: available.reduce((sum, account) => sum + account.price, 0),
    tiktok: tiktokMetrics(accounts, orders, month),
    customers: customerMetrics(orders, customers, month),
    recentOrders: [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, RECENT_ORDERS),
  };
}
