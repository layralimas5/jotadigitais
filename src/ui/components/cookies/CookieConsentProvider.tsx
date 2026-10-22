import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  isCurrentCookieConsent,
  newCookieConsent,
  type CookieConsent,
  type OptionalCookieCategory,
} from "@/domain/cookie-consent";

const STORAGE_KEY = "jota:cookie-consent";

function readConsent(): CookieConsent | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return isCurrentCookieConsent(parsed) ? parsed : null;
  } catch (error) {
    console.warn("Não foi possível ler a escolha de cookies", error);
    return null;
  }
}

function writeConsent(consent: CookieConsent): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
  } catch (error) {
    // Sem armazenamento (aba anônima bloqueada), a escolha vale só nesta visita.
    console.warn("Não foi possível guardar a escolha de cookies", error);
  }
}

interface CookieConsentContextValue {
  /** Nulo enquanto a pessoa não escolheu: nada opcional pode rodar. */
  consent: CookieConsent | null;
  allows: (category: OptionalCookieCategory) => boolean;
  decide: (choice: Record<OptionalCookieCategory, boolean>) => void;
  preferencesOpen: boolean;
  openPreferences: () => void;
  closePreferences: () => void;
}

const CookieConsentContext = createContext<CookieConsentContextValue | null>(null);

/**
 * Escolha de cookies da Política de Privacidade. Ferramenta analítica ou de marketing que entrar no site
 * deve carregar só quando `allows("analytics")` ou `allows("marketing")` for verdadeiro.
 */
export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsent] = useState<CookieConsent | null>(readConsent);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  const decide = useCallback((choice: Record<OptionalCookieCategory, boolean>) => {
    const next = newCookieConsent(choice);
    writeConsent(next);
    setConsent(next);
    setPreferencesOpen(false);
  }, []);

  const value = useMemo<CookieConsentContextValue>(
    () => ({
      consent,
      allows: (category) => consent?.[category] === true,
      decide,
      preferencesOpen,
      openPreferences: () => setPreferencesOpen(true),
      closePreferences: () => setPreferencesOpen(false),
    }),
    [consent, decide, preferencesOpen],
  );

  return <CookieConsentContext.Provider value={value}>{children}</CookieConsentContext.Provider>;
}

export function useCookieConsent(): CookieConsentContextValue {
  const value = useContext(CookieConsentContext);
  if (!value) throw new Error("useCookieConsent precisa do CookieConsentProvider.");
  return value;
}
