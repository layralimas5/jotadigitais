import { groupCustomers } from "@/domain/customer";
import { remindersOf, visibleNotifications, type AppNotification } from "@/domain/notification";
import type { AdminDeps } from "./admin-use-cases";
import { buildSearchIndex, type SearchItem } from "./search";

/** O que o sininho mostra agora: pedidos novos, novidades e lembretes, sem o que já foi apagado. */
export async function loadNotifications(deps: AdminDeps): Promise<AppNotification[]> {
  const [stored, dismissed, orders, leads] = await Promise.all([
    deps.notifications.listRecent(),
    deps.notifications.listDismissed(),
    deps.orders.listAll(),
    deps.leads.listAll(),
  ]);
  return visibleNotifications(stored, remindersOf(orders, leads), new Set(dismissed));
}

export function dismissNotifications(deps: AdminDeps, keys: readonly string[]): Promise<void> {
  return keys.length ? deps.notifications.dismiss(keys) : Promise.resolve();
}

/** Registros que o campo de busca do topo encontra. Carrega uma vez quando o campo recebe foco. */
export async function loadSearchIndex(deps: AdminDeps): Promise<SearchItem[]> {
  const [accounts, orders, records, leads, partners] = await Promise.all([
    deps.accounts.listAll(),
    deps.orders.listAll(),
    deps.customers.listAll(),
    deps.leads.listAll(),
    deps.partners.listAll(),
  ]);
  return buildSearchIndex({ accounts, orders, customers: groupCustomers(orders, records), leads, partners });
}
