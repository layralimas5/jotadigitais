import type { Cents } from "./money";
import type { Platform } from "./platform";

export const ACCOUNT_STATUSES = ["available", "reserved", "sold"] as const;

export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

/** Abaixo de 2 mil seguidores o TikTok Shop roda em modo piloto (alguns produtos ainda bloqueados). */
export type ShopTier = "pilot" | "full";

export const FULL_SHOP_MIN_FOLLOWERS = 2000;

/** Para entrar no Programa de Parcerias do YouTube o canal precisa de 1.000 inscritos e 4.000 horas. */
export const YOUTUBE_PARTNER_MIN_SUBSCRIBERS = 1000;
export const YOUTUBE_PARTNER_MIN_WATCH_HOURS = 4000;

export interface TikTokStats {
  likes: number;
  following: number;
}

export interface InstagramStats {
  posts: number;
  following: number;
  /** Conta profissional (criador ou comercial), com painel e estatísticas. */
  professional: boolean;
}

export interface YouTubeStats {
  views: number;
  videos: number;
  /** Horas de exibição públicas nos últimos 12 meses. */
  watchHours: number;
  monetized: boolean;
}

export type FacebookKind = "page" | "profile";

export interface FacebookStats {
  kind: FacebookKind;
  likes: number;
  monetized: boolean;
}

export interface PlatformStatsMap {
  tiktok: TikTokStats;
  instagram: InstagramStats;
  youtube: YouTubeStats;
  facebook: FacebookStats;
}

/** Rede e dados próprios dela andam juntos: o TypeScript não deixa misturar estatísticas de redes diferentes. */
export type PlatformStats = { [P in Platform]: { platform: P; stats: PlatformStatsMap[P] } }[Platform];

export interface AccountBase {
  slug: string;
  displayName: string;
  handle: string;
  niche: string | null;
  /** Seguidores, ou inscritos no YouTube. */
  followers: number;
  price: Cents;
  status: AccountStatus;
  description: string | null;
  /** A mesma foto de perfil usada na rede social. Sem ela, o site mostra as iniciais. */
  avatarUrl: string | null;
  images: string[];
  listedAt: string;
  /** Parceiro que forneceu a conta. Nulo quando a conta é da própria loja. */
  partnerId: string | null;
}

/** Dados que o administrador preenche. */
export type AccountData = AccountBase & PlatformStats;

export type Account = AccountData & {
  id: string;
  /** Prazo da reserva feita no checkout. `null` quando não há reserva ou o pagamento já foi confirmado. */
  reservedUntil: string | null;
};

export type AccountOf<P extends Platform> = Extract<Account, { platform: P }>;

/** Reserva vencida sem pagamento devolve a conta para a vitrine sem depender de rotina agendada. */
export function effectiveStatus(
  status: AccountStatus,
  reservedUntil: string | null,
  now: Date = new Date(),
): AccountStatus {
  if (status === "reserved" && reservedUntil && new Date(reservedUntil).getTime() <= now.getTime()) {
    return "available";
  }
  return status;
}

export function shopTierOf(account: Pick<Account, "followers">): ShopTier {
  return account.followers >= FULL_SHOP_MIN_FOLLOWERS ? "full" : "pilot";
}

export function followersToFullShop(account: Pick<Account, "followers">): number {
  return Math.max(FULL_SHOP_MIN_FOLLOWERS - account.followers, 0);
}

const NEW_LISTING_DAYS = 7;
const DAY_MS = 86_400_000;

export function isNewListing(account: Pick<Account, "listedAt">, now: Date = new Date()): boolean {
  return now.getTime() - new Date(account.listedAt).getTime() < NEW_LISTING_DAYS * DAY_MS;
}

export function isPurchasable(account: Pick<Account, "status">): boolean {
  return account.status === "available";
}

const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("pt-BR");

export function formatCount(value: number): string {
  return value < 10_000 ? full.format(value) : compact.format(value);
}

export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}
