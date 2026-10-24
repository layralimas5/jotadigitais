import type { Account } from "./account";
import type { CustomerSummary } from "./customer";
import type { Cents } from "./money";
import type { Order } from "./order";
import { matchReferralPartner } from "./referral";

/** Quem fornece contas para a loja e recebe uma parte de cada venda finalizada. */
export interface PartnerData {
  name: string;
  /** Só dígitos, com DDD (o DDI 55 é opcional). */
  whatsapp: string | null;
  instagram: string | null;
  /** Chave Pix para o repasse. */
  pixKey: string | null;
  /** Parte do valor de cada venda finalizada, de 0 a 100. */
  commissionPercent: number;
  notes: string | null;
  /** Parceiro inativo continua no histórico, mas não aparece para ligar a contas novas. */
  active: boolean;
}

export interface Partner extends PartnerData {
  id: string;
  createdAt: string;
}

export interface PartnerSummary {
  partner: Partner;
  accounts: Account[];
  inStock: number;
  sold: number;
  /** Soma das vendas finalizadas das contas do parceiro. */
  revenue: Cents;
  /** Parte do parceiro nessas vendas. */
  commission: Cents;
  /** Clientes que disseram ter vindo por indicação dele, do movimento mais recente para o mais antigo. */
  referredCustomers: CustomerSummary[];
  /** Compras feitas por esses clientes (pedidos pagos ou entregues e vendas lançadas). */
  referredPurchases: number;
  referredRevenue: Cents;
}

export const commissionOf = (revenue: Cents, percent: number): Cents => Math.round((revenue * percent) / 100);

/** Clientes indicados por cada parceiro. O nome digitado é comparado com todos os parceiros, para não ligar ao errado. */
function referralsByPartner(partners: readonly Partner[], customers: readonly CustomerSummary[]): Map<string, CustomerSummary[]> {
  const referrals = new Map<string, CustomerSummary[]>();
  for (const customer of customers) {
    if (customer.sheet.source !== "referral") continue;
    const partner = matchReferralPartner(customer.sheet.referredBy, partners);
    if (partner) referrals.set(partner.id, [...(referrals.get(partner.id) ?? []), customer]);
  }
  return referrals;
}

/**
 * Junta cada parceiro com as contas dele, as vendas finalizadas (pedidos entregues) dessas contas
 * e os clientes que ele indicou.
 */
export function summarizePartners(
  partners: readonly Partner[],
  accounts: readonly Account[],
  orders: readonly Order[],
  customers: readonly CustomerSummary[] = [],
): PartnerSummary[] {
  const referrals = referralsByPartner(partners, customers);
  return partners.map((partner) => {
    const referredCustomers = referrals.get(partner.id) ?? [];
    const owned = accounts.filter((account) => account.partnerId === partner.id);
    const ownedIds = new Set(owned.map((account) => account.id));
    const revenue = orders
      .filter((order) => order.status === "delivered" && order.accountId !== null && ownedIds.has(order.accountId))
      .reduce((sum, order) => sum + order.total, 0);
    return {
      partner,
      accounts: owned,
      inStock: owned.filter((account) => account.status !== "sold").length,
      sold: owned.filter((account) => account.status === "sold").length,
      revenue,
      commission: commissionOf(revenue, partner.commissionPercent),
      referredCustomers,
      referredPurchases: referredCustomers.reduce((sum, customer) => sum + customer.purchases, 0),
      referredRevenue: referredCustomers.reduce((sum, customer) => sum + customer.totalSpent, 0),
    };
  });
}
