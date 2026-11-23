import { shopTierOf, type Account } from "./account";

/**
 * Tipo de conta para o texto "Sobre esta conta". Cada tipo tem um modelo na aba Site; conta sem texto próprio usa o
 * modelo do seu tipo. TikTok com Shop e monetização ao mesmo tempo segue o modelo do Shop.
 */
export const DESCRIPTION_KINDS = [
  "tiktokShopFull",
  "tiktokShopPilot",
  "tiktokMonetized",
  "tiktok",
  "instagramMonetized",
  "instagram",
  "youtubeMonetized",
  "youtube",
  "facebookMonetized",
  "facebook",
] as const;

export type DescriptionKind = (typeof DESCRIPTION_KINDS)[number];

export type DescriptionTemplates = Record<DescriptionKind, string>;

export const DESCRIPTION_KIND_LABEL: Record<DescriptionKind, string> = {
  tiktokShopFull: "TikTok com Shop ativo",
  tiktokShopPilot: "TikTok com Shop piloto",
  tiktokMonetized: "TikTok monetizado (sem Shop)",
  tiktok: "TikTok comum",
  instagramMonetized: "Instagram monetizado",
  instagram: "Instagram comum",
  youtubeMonetized: "YouTube monetizado",
  youtube: "YouTube comum",
  facebookMonetized: "Facebook monetizado",
  facebook: "Facebook comum",
};

export const EMPTY_DESCRIPTION_TEMPLATES: DescriptionTemplates = Object.fromEntries(
  DESCRIPTION_KINDS.map((kind) => [kind, ""]),
) as DescriptionTemplates;

export const DESCRIPTION_TEMPLATE_MAX = 2000;

export function descriptionKindOf(account: Account): DescriptionKind {
  switch (account.platform) {
    case "tiktok": {
      const tier = shopTierOf(account);
      if (tier === "full") return "tiktokShopFull";
      if (tier === "pilot") return "tiktokShopPilot";
      return account.stats.monetized ? "tiktokMonetized" : "tiktok";
    }
    case "instagram":
      return account.stats.monetized ? "instagramMonetized" : "instagram";
    case "youtube":
      return account.stats.monetized ? "youtubeMonetized" : "youtube";
    case "facebook":
      return account.stats.monetized ? "facebookMonetized" : "facebook";
  }
}

/** Valores que entram no lugar de {rede}, {nicho}, {seguidores}, {curtidas} e {pais}. */
export interface DescriptionValues {
  rede: string;
  nicho: string;
  seguidores: string;
  curtidas: string;
  pais: string;
}

export const DESCRIPTION_VARIABLES: readonly (keyof DescriptionValues)[] = ["rede", "nicho", "seguidores", "curtidas", "pais"];

export function fillDescriptionTemplate(template: string, values: DescriptionValues): string {
  return DESCRIPTION_VARIABLES.reduce((text, key) => text.replaceAll(`{${key}}`, values[key]), template);
}
