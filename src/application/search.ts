import type { Account } from "@/domain/account";
import type { CustomerSummary } from "@/domain/customer";
import type { Lead } from "@/domain/lead";
import { formatBRL } from "@/domain/money";
import type { Order } from "@/domain/order";
import type { Partner } from "@/domain/partner";
import { PLATFORM_LABEL } from "@/domain/platform";
import { normalizeSearch } from "./catalog";

export const SEARCH_GROUPS = ["page", "account", "order", "customer", "lead", "partner"] as const;
export type SearchGroup = (typeof SEARCH_GROUPS)[number];

export const SEARCH_GROUP_LABEL: Record<SearchGroup, string> = {
  page: "Telas",
  account: "Contas",
  order: "Pedidos",
  customer: "Clientes",
  lead: "CRM",
  partner: "Parceiros",
};

export interface SearchItem {
  id: string;
  group: SearchGroup;
  title: string;
  subtitle: string;
  /** Rota do painel que abre o resultado. */
  to: string;
  /** Texto extra que também conta na busca (ex.: e-mail, WhatsApp), sem aparecer na tela. */
  keywords?: string;
}

export interface SearchSource {
  accounts: Account[];
  orders: Order[];
  customers: CustomerSummary[];
  leads: Lead[];
  partners: Partner[];
}

const ORDER_STATUS_LABEL = {
  awaiting_payment: "aguardando pagamento",
  paid: "pago, falta entregar",
  delivered: "entregue",
  canceled: "cancelado",
} as const;

/** Tudo que dá para encontrar pelo campo de busca do topo, já com a tela que abre cada resultado. */
export function buildSearchIndex(source: SearchSource): SearchItem[] {
  return [
    ...source.accounts.map<SearchItem>((account) => ({
      id: `account:${account.id}`,
      group: "account",
      title: account.displayName,
      subtitle: `${account.handle} · ${PLATFORM_LABEL[account.platform]} · ${formatBRL(account.price)}`,
      to: `/admin/contas/${account.id}`,
      keywords: `${account.handle} ${account.niche ?? ""} ${account.slug}`,
    })),
    ...source.orders.map<SearchItem>((order) => ({
      id: `order:${order.code}`,
      group: "order",
      title: `Pedido ${order.code}`,
      subtitle: `${order.customer.name} · ${order.accountHandle} · ${ORDER_STATUS_LABEL[order.status]}`,
      to: order.status === "delivered" ? "/admin/finalizados" : "/admin/pedidos",
      keywords: `${order.code} ${order.customer.email} ${order.customer.name} ${order.accountHandle}`,
    })),
    ...source.customers.map<SearchItem>((customer) => ({
      id: `customer:${customer.key}`,
      group: "customer",
      title: customer.name,
      subtitle: customer.email ?? customer.instagram ?? "Cliente",
      to: `/admin/clientes/${encodeURIComponent(customer.key)}`,
      keywords: `${customer.email ?? ""} ${customer.whatsapp ?? ""} ${customer.instagram ?? ""}`,
    })),
    ...source.leads.map<SearchItem>((lead) => ({
      id: `lead:${lead.id}`,
      group: "lead",
      title: lead.name,
      subtitle: "Contato do CRM",
      to: `/admin/crm/${lead.id}`,
      keywords: `${lead.whatsapp ?? ""} ${lead.instagram ?? ""}`,
    })),
    ...source.partners.map<SearchItem>((partner) => ({
      id: `partner:${partner.id}`,
      group: "partner",
      title: partner.name,
      subtitle: "Parceiro",
      to: `/admin/parceiros/${partner.id}`,
      keywords: `${partner.whatsapp ?? ""} ${partner.instagram ?? ""}`,
    })),
  ];
}

/** Começar com o termo vale mais do que conter o termo no meio. */
function scoreOf(item: SearchItem, needle: string): number {
  const title = normalizeSearch(item.title);
  if (title.startsWith(needle)) return 3;
  if (title.includes(needle)) return 2;
  const rest = normalizeSearch(`${item.subtitle} ${item.keywords ?? ""}`);
  if (rest.includes(needle)) return 1;
  const digits = needle.replace(/\D/g, "");
  return digits.length >= 4 && rest.replace(/\D/g, "").includes(digits) ? 1 : 0;
}

const MAX_PER_GROUP = 5;

/** Resultados na ordem dos grupos, os mais parecidos primeiro e no máximo cinco por grupo. */
export function searchItems(items: readonly SearchItem[], query: string): SearchItem[] {
  const needle = normalizeSearch(query);
  if (!needle) return [];
  const scored = items
    .map((item) => ({ item, score: scoreOf(item, needle) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
  return SEARCH_GROUPS.flatMap((group) =>
    scored
      .filter((entry) => entry.item.group === group)
      .slice(0, MAX_PER_GROUP)
      .map((entry) => entry.item),
  );
}
