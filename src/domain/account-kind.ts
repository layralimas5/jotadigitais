import { shopTierOf, type Account } from "./account";
import type { Platform } from "./platform";

/** Recortes da vitrine pelo que a conta tem (`/contas?tipo=`): o quadro da página da conta leva para eles. */
export const ACCOUNT_KINDS = ["tiktok-shop", "shop-ativo", "tiktok-monetizada", "instagram-shop", "instagram-monetizada", "youtube-monetizado"] as const;

export type AccountKind = (typeof ACCOUNT_KINDS)[number];

export const ACCOUNT_KIND_LABEL: Record<AccountKind, string> = {
  "tiktok-shop": "TikTok com Shop",
  "shop-ativo": "TikTok com Shop ativo",
  "tiktok-monetizada": "TikTok monetizadas",
  "instagram-shop": "Instagram com Shop",
  "instagram-monetizada": "Instagram monetizadas",
  "youtube-monetizado": "Canais monetizados",
};

export const ACCOUNT_KIND_PLATFORM: Record<AccountKind, Platform> = {
  "tiktok-shop": "tiktok",
  "shop-ativo": "tiktok",
  "tiktok-monetizada": "tiktok",
  "instagram-shop": "instagram",
  "instagram-monetizada": "instagram",
  "youtube-monetizado": "youtube",
};

export const isAccountKind = (value: unknown): value is AccountKind => (ACCOUNT_KINDS as readonly unknown[]).includes(value);

export function matchesAccountKind(account: Account, kind: AccountKind): boolean {
  switch (kind) {
    case "tiktok-shop":
      return account.platform === "tiktok" && shopTierOf(account) !== "none";
    case "shop-ativo":
      return account.platform === "tiktok" && shopTierOf(account) === "full";
    case "tiktok-monetizada":
      return account.platform === "tiktok" && account.stats.monetized;
    case "instagram-shop":
      return account.platform === "instagram" && account.stats.shop === true;
    case "instagram-monetizada":
      return account.platform === "instagram" && account.stats.monetized;
    case "youtube-monetizado":
      return account.platform === "youtube" && account.stats.monetized;
  }
}

/** Endereço da vitrine com o recorte (a rede vai junto para o filtro de rede já aparecer marcado). */
export const catalogPathOf = (kind: AccountKind) => `/contas?rede=${ACCOUNT_KIND_PLATFORM[kind]}&tipo=${kind}`;
