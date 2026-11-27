import type { Account } from "./account";
import { STOCK_CATEGORIES, stockCategoryOf, type StockCategory } from "./stock";

/** O que o Jota tirou da vitrine: tudo (entre uma remessa e outra) ou só alguns tipos de estoque. */
export interface StorefrontVisibility {
  closed: boolean;
  hiddenCategories: readonly StockCategory[];
}

/** Vitrine fechada de vez: desligada no botão geral ou com todos os tipos fora. */
export const isStorefrontClosed = (visibility: StorefrontVisibility): boolean =>
  visibility.closed || STOCK_CATEGORIES.every((category) => visibility.hiddenCategories.includes(category));

/** A conta aparece no site e pode ser comprada? */
export const isShownInStorefront = (visibility: StorefrontVisibility, account: Account): boolean =>
  !isStorefrontClosed(visibility) && !visibility.hiddenCategories.includes(stockCategoryOf(account));
