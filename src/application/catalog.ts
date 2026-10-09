import type { Account, AccountStatus } from "@/domain/account";
import type { AccountFilter, AccountSort } from "./ports";

const sorters: Record<AccountSort, (a: Account, b: Account) => number> = {
  recent: (a, b) => b.listedAt.localeCompare(a.listedAt),
  "price-asc": (a, b) => a.price - b.price || b.followers - a.followers,
  "followers-desc": (a, b) => b.followers - a.followers,
};

const statusWeight: Record<AccountStatus, number> = { available: 0, reserved: 1, sold: 2 };

/** Disponíveis primeiro; dentro de cada grupo, a ordenação escolhida. */
export function sortAccounts(accounts: Account[], sort: AccountSort = "recent"): Account[] {
  const compare = sorters[sort];
  return [...accounts].sort((a, b) => statusWeight[a.status] - statusWeight[b.status] || compare(a, b));
}

export function normalizeSearch(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

export function matchesFilter(account: Account, filter: AccountFilter): boolean {
  if (filter.onlyAvailable && account.status !== "available") return false;
  if (filter.platform && account.platform !== filter.platform) return false;
  if (filter.minFollowers !== undefined && account.followers < filter.minFollowers) return false;
  if (filter.maxFollowers !== undefined && account.followers >= filter.maxFollowers) return false;
  if (filter.query) {
    const haystack = normalizeSearch(`${account.displayName} ${account.handle} ${account.niche ?? ""}`);
    if (!haystack.includes(normalizeSearch(filter.query))) return false;
  }
  return true;
}
