import type { Account, AccountStatus } from "@/domain/account";
import { DEFAULT_COUNTRY, sortCountries, type Country } from "@/domain/country";
import { stockCategoryOf, type StockCategory } from "@/domain/stock";
import type { AccountFilter, AccountSort } from "./ports";

const OTHER_NETWORKS_GROUP = 3;

const FEATURED_GROUP: Partial<Record<StockCategory, number>> = { shop_full: 0, shop_pilot: 1, tiktok_monetized: 2 };

/** Foco da loja, pedido do Jota: 0 = TikTok Shop ativo, 1 = Shop piloto, 2 = TikTok monetizado, 3 = o resto (outras redes). */
const featuredGroupOf = (account: Account): number => FEATURED_GROUP[stockCategoryOf(account)] ?? OTHER_NETWORKS_GROUP;

const byRecent = (a: Account, b: Account) => b.listedAt.localeCompare(a.listedAt);
const brazilFirst = (a: Account, b: Account) => Number(a.country !== DEFAULT_COUNTRY) - Number(b.country !== DEFAULT_COUNTRY);
const bySize = (a: Account, b: Account) => a.followers - b.followers || a.price - b.price;

/** Nos grupos de TikTok, as brasileiras primeiro e do menor para o maior (1k, 2k, 3k...); nas outras redes, as mais recentes. */
function byFeatured(a: Account, b: Account): number {
  const group = featuredGroupOf(a) - featuredGroupOf(b);
  if (group !== 0) return group;
  return featuredGroupOf(a) === OTHER_NETWORKS_GROUP ? byRecent(a, b) : brazilFirst(a, b) || bySize(a, b);
}

const sorters: Record<AccountSort, (a: Account, b: Account) => number> = {
  featured: byFeatured,
  recent: byRecent,
  "price-asc": (a, b) => a.price - b.price || b.followers - a.followers,
  "followers-desc": (a, b) => b.followers - a.followers,
};

const statusWeight: Record<AccountStatus, number> = { available: 0, reserved: 1, sold: 2 };

/** Disponíveis primeiro; dentro de cada grupo, a ordenação escolhida. */
export function sortAccounts(accounts: Account[], sort: AccountSort = "recent"): Account[] {
  const compare = sorters[sort];
  return [...accounts].sort((a, b) => statusWeight[a.status] - statusWeight[b.status] || compare(a, b));
}

/** Países que têm conta na vitrine, sem repetir; Brasil primeiro. */
export function countriesInStock(accounts: readonly Account[]): Country[] {
  const byCode = new Map<string, Country>();
  for (const account of accounts) byCode.set(account.country, { code: account.country, name: account.countryName });
  return sortCountries([...byCode.values()]);
}

export function normalizeSearch(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

export function matchesFilter(account: Account, filter: AccountFilter): boolean {
  if (filter.onlyAvailable && account.status !== "available") return false;
  if (filter.platform && account.platform !== filter.platform) return false;
  if (filter.country && (account.country ?? DEFAULT_COUNTRY) !== filter.country) return false;
  if (filter.minFollowers !== undefined && account.followers < filter.minFollowers) return false;
  if (filter.maxFollowers !== undefined && account.followers >= filter.maxFollowers) return false;
  if (filter.query) {
    const haystack = normalizeSearch(`${account.displayName} ${account.handle} ${account.niche ?? ""} ${account.countryName}`);
    if (!haystack.includes(normalizeSearch(filter.query))) return false;
  }
  return true;
}
