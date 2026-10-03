import type { Cents } from "./money";

export const NICHES = [
  "Moda",
  "Beleza",
  "Casa",
  "Notícias",
  "Humor",
  "Fitness",
  "Tecnologia",
  "Pets",
  "Culinária",
  "Lifestyle",
] as const;

export type Niche = (typeof NICHES)[number];

export type AccountStatus = "available" | "reserved" | "sold";

/** Abaixo de 2 mil seguidores o TikTok Shop roda em modo piloto (alguns produtos ainda bloqueados). */
export type ShopTier = "pilot" | "full";

export const FULL_SHOP_MIN_FOLLOWERS = 2000;

export interface TikTokAccount {
  id: string;
  slug: string;
  displayName: string;
  handle: string;
  niche: Niche;
  followers: number;
  likes: number;
  following: number;
  price: Cents;
  status: AccountStatus;
  listedAt: string;
}

export function shopTierOf(account: Pick<TikTokAccount, "followers">): ShopTier {
  return account.followers >= FULL_SHOP_MIN_FOLLOWERS ? "full" : "pilot";
}

export function isPurchasable(account: Pick<TikTokAccount, "status">): boolean {
  return account.status === "available";
}

const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("pt-BR");

export function formatCount(value: number): string {
  return value < 10_000 ? full.format(value) : compact.format(value);
}
