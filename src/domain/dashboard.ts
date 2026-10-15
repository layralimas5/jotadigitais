import type { Account } from "./account";
import { rangeOf, summarizeFinance, toLocalIsoDate, type Expense, type FinanceSummary } from "./finance";
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
}

export interface StockByPlatform {
  platform: Platform;
  available: number;
  reserved: number;
}

export interface Dashboard {
  month: FinanceSummary;
  last30Days: FinanceSummary;
  finalizedThisMonth: number;
  /** Pedidos com reserva valendo, esperando o Pix ou o cartão. */
  awaitingPayment: number;
  /** Pagos que ainda não foram entregues. */
  awaitingDelivery: number;
  /** Leads com retorno vencido ou marcado para hoje. */
  followUpsDue: number;
  /** Parte dos parceiros nas vendas finalizadas este mês. */
  commissionThisMonth: Cents;
  stock: StockByPlatform[];
  stockValue: Cents;
  recentOrders: Order[];
}

const RECENT_ORDERS = 5;

export function buildDashboard(source: DashboardSource, now: Date = new Date()): Dashboard {
  const { orders, expenses, accounts, leads, partners } = source;
  const month = rangeOf("this_month", now);
  const today = toLocalIsoDate(now);
  const available = accounts.filter((account) => account.status === "available");
  const finalizedThisMonth = finalizedSales(orders).filter(
    (order) => toLocalIsoDate(new Date(deliveredAtOf(order))) >= (month.from ?? ""),
  );

  return {
    month: summarizeFinance(orders, expenses, month, now),
    last30Days: summarizeFinance(orders, expenses, rangeOf("last_30_days", now), now),
    finalizedThisMonth: finalizedThisMonth.length,
    awaitingPayment: orders.filter((order) => order.status === "awaiting_payment" && !isReservationExpired(order, now)).length,
    awaitingDelivery: orders.filter((order) => order.status === "paid").length,
    followUpsDue: leads.filter((lead) => {
      const status = followUpStatusOf(lead, today);
      return status === "overdue" || status === "today";
    }).length,
    commissionThisMonth: summarizePartners(partners, accounts, finalizedThisMonth).reduce((sum, summary) => sum + summary.commission, 0),
    stock: PLATFORMS.map((platform) => ({
      platform,
      available: available.filter((account) => account.platform === platform).length,
      reserved: accounts.filter((account) => account.platform === platform && account.status === "reserved").length,
    })),
    stockValue: available.reduce((sum, account) => sum + account.price, 0),
    recentOrders: [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, RECENT_ORDERS),
  };
}
