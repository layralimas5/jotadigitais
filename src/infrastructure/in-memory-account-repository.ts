import type { TikTokAccount } from "@/domain/account";
import type { AccountFilter, AccountRepository, AccountSort } from "@/application/ports";

const SIMULATED_LATENCY_MS = 250;

const sorters: Record<AccountSort, (a: TikTokAccount, b: TikTokAccount) => number> = {
  recent: (a, b) => b.listedAt.localeCompare(a.listedAt),
  "price-asc": (a, b) => a.price - b.price || b.followers - a.followers,
  "followers-desc": (a, b) => b.followers - a.followers,
};

const statusWeight: Record<TikTokAccount["status"], number> = { available: 0, reserved: 1, sold: 2 };

function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function matches(account: TikTokAccount, filter: AccountFilter): boolean {
  if (filter.onlyAvailable && account.status !== "available") return false;
  if (filter.niche && account.niche !== filter.niche) return false;
  if (filter.minFollowers !== undefined && account.followers < filter.minFollowers) return false;
  if (filter.maxFollowers !== undefined && account.followers >= filter.maxFollowers) return false;
  if (filter.query) {
    const haystack = normalize(`${account.displayName} ${account.handle} ${account.niche}`);
    if (!haystack.includes(normalize(filter.query.trim()))) return false;
  }
  return true;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class InMemoryAccountRepository implements AccountRepository {
  private readonly accounts: readonly TikTokAccount[];

  constructor(accounts: readonly TikTokAccount[]) {
    this.accounts = accounts;
  }

  async list(filter: AccountFilter): Promise<TikTokAccount[]> {
    await wait(SIMULATED_LATENCY_MS);
    const sort = sorters[filter.sort ?? "recent"];
    return this.accounts
      .filter((account) => matches(account, filter))
      .sort((a, b) => statusWeight[a.status] - statusWeight[b.status] || sort(a, b));
  }

  async findBySlug(slug: string): Promise<TikTokAccount | null> {
    await wait(SIMULATED_LATENCY_MS);
    return this.accounts.find((account) => account.slug === slug) ?? null;
  }

  async findById(id: string): Promise<TikTokAccount | null> {
    return this.accounts.find((account) => account.id === id) ?? null;
  }
}
