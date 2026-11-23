import type { Account } from "./account";
import { STOCK_CATEGORY_LABEL, stockCategoryOf, type StockCategory } from "./stock";

/**
 * Lista de espera: o cliente pede para ser avisado quando chegar conta de um tipo. Facebook fica de fora porque a
 * loja não compra mais contas de Facebook.
 */
export const STOCK_ALERT_CATEGORIES = ["shop_full", "shop_pilot", "tiktok_monetized", "tiktok", "instagram", "youtube"] as const satisfies readonly StockCategory[];

export type StockAlertCategory = (typeof STOCK_ALERT_CATEGORIES)[number];

export const STOCK_ALERT_CATEGORY_LABEL: Record<StockAlertCategory, string> = {
  shop_full: STOCK_CATEGORY_LABEL.shop_full,
  shop_pilot: STOCK_CATEGORY_LABEL.shop_pilot,
  tiktok_monetized: STOCK_CATEGORY_LABEL.tiktok_monetized,
  tiktok: STOCK_CATEGORY_LABEL.tiktok,
  instagram: STOCK_CATEGORY_LABEL.instagram,
  youtube: STOCK_CATEGORY_LABEL.youtube,
};

export interface StockAlertData {
  name: string;
  /** Só os números, com DDD. */
  whatsapp: string;
  categories: StockAlertCategory[];
}

export interface StockAlert extends StockAlertData {
  id: string;
  createdAt: string;
  /** Quando o Jota avisou. Nulo: ainda esperando. */
  notifiedAt: string | null;
}

export const isWaiting = (alert: Pick<StockAlert, "notifiedAt">) => alert.notifiedAt === null;

export const isStockAlertCategory = (value: unknown): value is StockAlertCategory =>
  (STOCK_ALERT_CATEGORIES as readonly unknown[]).includes(value);

/** Tipos que têm conta disponível na vitrine agora. */
export function categoriesInStock(accounts: readonly Account[]): Set<StockCategory> {
  return new Set(accounts.filter((account) => account.status === "available").map(stockCategoryOf));
}

/** Tipos que a pessoa pediu e que já têm conta disponível: é hora de avisar. */
export const readyCategoriesOf = (alert: Pick<StockAlert, "categories">, inStock: ReadonlySet<StockCategory>) =>
  alert.categories.filter((category) => inStock.has(category));

/** Pessoas esperando que já podem ser avisadas (algum tipo pedido tem conta disponível). */
export function alertsReadyToNotify(alerts: readonly StockAlert[], accounts: readonly Account[]): StockAlert[] {
  const inStock = categoriesInStock(accounts);
  return alerts.filter((alert) => isWaiting(alert) && readyCategoriesOf(alert, inStock).length > 0);
}

const listFormat = new Intl.ListFormat("pt-BR", { style: "long", type: "conjunction" });

export const categoriesLabel = (categories: readonly StockAlertCategory[]) =>
  listFormat.format(categories.map((category) => STOCK_ALERT_CATEGORY_LABEL[category]));
