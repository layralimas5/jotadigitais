import type { Account } from "./account";
import type { AdminUser } from "./admin-user";
import type { CustomerRecord } from "./customer";
import type { Expense } from "./finance";
import type { Lead } from "./lead";
import type { MessageTemplates } from "./message-template";
import type { Order } from "./order";
import type { Partner } from "./partner";
import type { StoreSettings } from "./store-settings";
import type { Testimonial } from "./testimonial";

export const BACKUP_FORMAT = "jota-digitais-backup";
export const BACKUP_VERSION = 1;

export interface BackupData {
  accounts: Account[];
  orders: Order[];
  customers: CustomerRecord[];
  leads: Lead[];
  partners: Partner[];
  expenses: Expense[];
  testimonials: Testimonial[];
  storeSettings: StoreSettings;
  messageTemplates: MessageTemplates;
  /** Só nome e e-mail: senha nunca sai do Supabase Auth. */
  adminUsers: AdminUser[];
}

/** Cópia de tudo que o painel cadastra, num arquivo que o Jota guarda fora do sistema. */
export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  createdAt: string;
  data: BackupData;
}

export interface BackupCount {
  /** Ex.: "1 conta", "13 contas". */
  label: string;
  count: number;
}

const counted = (count: number, one: string, many: string): BackupCount => ({
  label: `${count} ${count === 1 ? one : many}`,
  count,
});

export function backupCounts(data: BackupData): BackupCount[] {
  return [
    counted(data.accounts.length, "conta", "contas"),
    counted(data.orders.length, "pedido", "pedidos"),
    counted(data.customers.length, "cliente", "clientes"),
    counted(data.leads.length, "lead", "leads"),
    counted(data.partners.length, "parceiro", "parceiros"),
    counted(data.expenses.length, "despesa", "despesas"),
    counted(data.testimonials.length, "depoimento", "depoimentos"),
    counted(data.adminUsers.length, "usuário", "usuários"),
  ];
}

const pad = (value: number) => String(value).padStart(2, "0");

/** Ex.: jota-digitais-backup-2026-10-19-1530.json, no horário de quem baixou. */
export function backupFileName(date: Date): string {
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `${BACKUP_FORMAT}-${day}-${pad(date.getHours())}${pad(date.getMinutes())}.json`;
}
