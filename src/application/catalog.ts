import { isMonetized, shopTierOf, type Account, type AccountStatus } from "@/domain/account";
import { DEFAULT_COUNTRY, sortCountries, type Country } from "@/domain/country";
import type { AccountFilter, AccountSort } from "./ports";

/** Foco da loja: 0 = TikTok com Shop (piloto ou ativo), 1 = monetizadas, 2 = o resto (outras redes e TikTok sem Shop). */
function featuredGroupOf(account: Account): number {
  if (account.platform === "tiktok" && shopTierOf(account) !== "none") return 0;
  return isMonetized(account) ? 1 : 2;
}

const byRecent = (a: Account, b: Account) => b.listedAt.localeCompare(a.listedAt);

/** TikTok com Shop do menor para o maior (1k, 2k, 3k...), o que já põe o Shop piloto na frente; nos outros grupos, as mais recentes. */
function byFeatured(a: Account, b: Account): number {
  const group = featuredGroupOf(a) - featuredGroupOf(b);
  if (group !== 0) return group;
  return featuredGroupOf(a) === 0 ? a.followers - b.followers || a.price - b.price : byRecent(a, b);
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
