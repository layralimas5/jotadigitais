import { siteContentSchema, storeSettingsSchema } from "@/application/schemas";
import { mergeWithDefaults, type SiteContent } from "@/domain/site-content";
import type { StoreSettings } from "@/domain/store-settings";

/**
 * Última versão dos textos do site e das configurações da loja, guardada no navegador. O site abre com ela na hora
 * em vez de mostrar o texto de fábrica e trocar segundos depois (chamado "Bug quando abre o site"). O painel fica
 * no mesmo endereço, então salvar ali já atualiza esta cópia.
 */
const SITE_CONTENT_KEY = "jota:site-content";
const STORE_SETTINGS_KEY = "jota:store-settings";

function read(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as unknown);
  } catch {
    // Navegação anônima ou armazenamento bloqueado: sem cópia, o site busca normalmente.
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("Não foi possível guardar a cópia do site neste navegador", error);
  }
}

/** Cópia que não passa na validação (versão antiga do site, edição na mão) é ignorada. */
export function readCachedSiteContent(): SiteContent | null {
  const saved = read(SITE_CONTENT_KEY);
  if (saved === null) return null;
  const parsed = siteContentSchema.safeParse(mergeWithDefaults(saved));
  return parsed.success ? parsed.data : null;
}

export const cacheSiteContent = (content: SiteContent): void => write(SITE_CONTENT_KEY, content);

export function readCachedStoreSettings(): StoreSettings | null {
  const saved = read(STORE_SETTINGS_KEY);
  if (saved === null) return null;
  const parsed = storeSettingsSchema.safeParse(saved);
  return parsed.success ? parsed.data : null;
}

export const cacheStoreSettings = (settings: StoreSettings): void => write(STORE_SETTINGS_KEY, settings);
