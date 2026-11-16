import type { ShopTier } from "./account";

/**
 * Cor de fundo que o Jota escolhe para cada tag. Vale para todas as contas: a tag "Nicho quente" tem a mesma cor
 * em qualquer card. As fixas têm chave própria porque o nome muda por rede ("Monetizada", "Monetizado"...).
 */
export type TagColors = Readonly<Record<string, string>>;

export const MONETIZED_TAG_KEY = "fixed:monetized";
export const SHOP_TAG_KEY: Record<Exclude<ShopTier, "none">, string> = {
  pilot: "fixed:shop-pilot",
  full: "fixed:shop-full",
};

/** Tag criada pelo Jota: a mesma chave para "Nicho quente" e "nicho quente". */
export const customTagKey = (label: string) => `tag:${label.trim().replace(/\s+/g, " ").toLowerCase()}`;

/** Mesmo limite da checagem `account_tag_colors_key` no banco (prefixo + tag de até 24 letras). */
export const MAX_TAG_KEY_LENGTH = 40;
export const TAG_KEY_PATTERN = /^(fixed:(monetized|shop-pilot|shop-full)|tag:\S(.*\S)?)$/;
export const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/;

/** Sugestões do seletor; o Jota também pode escolher qualquer outra. */
export const TAG_COLOR_PRESETS = [
  "#2799ff",
  "#ff3d8b",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#f5f5f5",
  "#1f2937",
] as const;

function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** Texto preto ou branco, o que tiver mais contraste com o fundo escolhido. */
export function readableTextOn(hex: string): "#ffffff" | "#0a0a0f" {
  const background = luminance(hex);
  const onWhite = 1.05 / (background + 0.05);
  const onBlack = (background + 0.05) / 0.05;
  return onBlack >= onWhite ? "#0a0a0f" : "#ffffff";
}
