import type { Account } from "./account";
import type { Cents } from "./money";
import type { Order } from "./order";

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
}

export const commissionOf = (revenue: Cents, percent: number): Cents => Math.round((revenue * percent) / 100);

/** Junta cada parceiro com as contas dele e as vendas finalizadas (pedidos entregues) dessas contas. */
export function summarizePartners(partners: readonly Partner[], accounts: readonly Account[], orders: readonly Order[]): PartnerSummary[] {
  return partners.map((partner) => {
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
    };
  });
}
