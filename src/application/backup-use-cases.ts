import { BACKUP_FORMAT, BACKUP_VERSION, type Backup } from "@/domain/backup";
import type { AdminDeps } from "./admin-use-cases";

/** Lê tudo de uma vez: se uma parte falhar, nenhum arquivo pela metade é gerado. */
export async function createBackup(deps: AdminDeps, now: Date = new Date()): Promise<Backup> {
  const [accounts, orders, customers, leads, partners, expenses, testimonials, storeSettings, messageTemplates, adminUsers] =
    await Promise.all([
      deps.accounts.listAll(),
      deps.orders.listAll(),
      deps.customers.listAll(),
      deps.leads.listAll(),
      deps.partners.listAll(),
      deps.expenses.listAll(),
      deps.testimonials.listAll(),
      deps.settings.get(),
      deps.templates.getAll(),
      deps.users.listAll(),
    ]);
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: now.toISOString(),
    data: { accounts, orders, customers, leads, partners, expenses, testimonials, storeSettings, messageTemplates, adminUsers },
  };
}
