/** Categorias da Política de Privacidade (seção 12). Necessários sempre valem e não entram na escolha. */
export const OPTIONAL_COOKIE_CATEGORIES = ["analytics", "marketing"] as const;
export type OptionalCookieCategory = (typeof OPTIONAL_COOKIE_CATEGORIES)[number];

/** Versão da pergunta: quando entrar uma ferramenta nova, sobe a versão e o aviso aparece de novo para todos. */
export const COOKIE_CONSENT_VERSION = 1;

export interface CookieConsent {
  version: number;
  analytics: boolean;
  marketing: boolean;
  decidedAt: string;
}

export const COOKIE_CATEGORY_VIEW: Record<"necessary" | OptionalCookieCategory, { label: string; description: string }> = {
  necessary: {
    label: "Necessários",
    description: "Guardam esta escolha, lembram que o convite do WhatsApp já apareceu e mantêm o login do painel. Sempre ativos.",
  },
  analytics: {
    label: "Analíticos",
    description: "Medem visitas e cliques de forma agregada para melhorar o site. Hoje nenhum está em uso.",
  },
  marketing: {
    label: "Marketing",
    description: "Medem anúncios e criam públicos em redes sociais. Hoje nenhum está em uso.",
  },
};

export function newCookieConsent(choice: Record<OptionalCookieCategory, boolean>, now: Date = new Date()): CookieConsent {
  return { version: COOKIE_CONSENT_VERSION, ...choice, decidedAt: now.toISOString() };
}

export function isCurrentCookieConsent(value: unknown): value is CookieConsent {
  if (typeof value !== "object" || value === null) return false;
  const consent = value as Partial<CookieConsent>;
  return (
    consent.version === COOKIE_CONSENT_VERSION &&
    typeof consent.analytics === "boolean" &&
    typeof consent.marketing === "boolean" &&
    typeof consent.decidedAt === "string"
  );
}
