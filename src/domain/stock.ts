import { isMonetized, shopTierOf, type Account } from "./account";

/**
 * Tipos de conta do estoque, na ordem da vitrine pedida pelo Jota: Shop ativo, Shop piloto, TikTok monetizado e depois
 * o resto. Cada conta cai em um tipo só, para a soma bater com o total.
 */
export const STOCK_CATEGORIES = ["shop_full", "shop_pilot", "tiktok_monetized", "tiktok", "instagram", "youtube", "facebook"] as const;

export type StockCategory = (typeof STOCK_CATEGORIES)[number];

export const STOCK_CATEGORY_LABEL: Record<StockCategory, string> = {
  shop_full: "Shop ativo",
  shop_pilot: "Shop piloto",
  tiktok_monetized: "TikTok monetizado",
  tiktok: "TikTok sem Shop",
  instagram: "Instagram",
  youtube: "YouTube",
  facebook: "Facebook",
};

/** Com essa quantidade disponível ou menos, o tipo aparece como "acabando" para o Jota repor. */
export const LOW_STOCK_THRESHOLD = 2;

/** A loja não compra mais contas de Facebook (só restam as antigas): não faz sentido avisar para repor. */
const RETIRED_CATEGORIES: ReadonlySet<StockCategory> = new Set(["facebook"]);

export function stockCategoryOf(account: Account): StockCategory {
  if (account.platform !== "tiktok") return account.platform;
  const shop = shopTierOf(account);
  if (shop === "full") return "shop_full";
  if (shop === "pilot") return "shop_pilot";
  return isMonetized(account) ? "tiktok_monetized" : "tiktok";
}

export interface StockCount {
  category: StockCategory;
  available: number;
  low: boolean;
}

/**
 * Disponíveis por tipo. Só entram os tipos que a loja já trabalhou (alguma conta cadastrada, vendida ou não):
 * tipo que nunca teve conta não é estoque acabando.
 */
export function countStockByCategory(accounts: readonly Account[]): StockCount[] {
  const worked = new Set(accounts.map(stockCategoryOf));
  return STOCK_CATEGORIES.filter((category) => worked.has(category)).map((category) => {
    const available = accounts.filter((account) => account.status === "available" && stockCategoryOf(account) === category).length;
    return { category, available, low: !RETIRED_CATEGORIES.has(category) && available <= LOW_STOCK_THRESHOLD };
  });
}
