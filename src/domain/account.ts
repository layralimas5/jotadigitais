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

/** Quanto falta (0 a 1) para a conta sair do Shop piloto. */
export function fullShopProgress(account: Pick<TikTokAccount, "followers">): number {
  return Math.min(account.followers / FULL_SHOP_MIN_FOLLOWERS, 1);
}

export function followersToFullShop(account: Pick<TikTokAccount, "followers">): number {
  return Math.max(FULL_SHOP_MIN_FOLLOWERS - account.followers, 0);
}

const NEW_LISTING_DAYS = 7;
const DAY_MS = 86_400_000;

export function isNewListing(account: Pick<TikTokAccount, "listedAt">, now: Date = new Date()): boolean {
  return now.getTime() - new Date(account.listedAt).getTime() < NEW_LISTING_DAYS * DAY_MS;
}

export function isPurchasable(account: Pick<TikTokAccount, "status">): boolean {
  return account.status === "available";
}

const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("pt-BR");

export function formatCount(value: number): string {
  return value < 10_000 ? full.format(value) : compact.format(value);
}
