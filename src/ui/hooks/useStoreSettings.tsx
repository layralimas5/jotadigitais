import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { container } from "@/app/container";
import { defaultStoreSettings } from "@/app/config";
import { getStoreSettings } from "@/application/use-cases";
import { instagramUrlOf, whatsappUrlOf, type StoreSettings } from "@/domain/store-settings";
import { cacheStoreSettings, readCachedStoreSettings } from "@/ui/lib/site-cache";

export interface StoreContact extends StoreSettings {
  whatsappUrl: string | null;
  instagramUrl: string;
}

const toContact = (settings: StoreSettings): StoreContact => ({
  ...settings,
  whatsappUrl: whatsappUrlOf(settings),
  instagramUrl: instagramUrlOf(settings),
});

const StoreSettingsContext = createContext<StoreContact>(toContact(defaultStoreSettings));
const StoreSettingsReadyContext = createContext(true);

let settingsRequest: Promise<StoreSettings> | null = null;

function loadStoreSettings(): Promise<StoreSettings> {
  settingsRequest ??= getStoreSettings(container.store).then((settings) => {
    cacheStoreSettings(settings);
    return settings;
  });
  return settingsRequest;
}

/**
 * Configurações salvas no painel (garantia, Instagram, WhatsApp, Pix). Abre com a cópia do navegador; sem ela, fica
 * "não pronto" até o banco responder. Se o banco falhar, o site usa os valores padrão.
 */
export function StoreSettingsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(() => {
    const cached = readCachedStoreSettings();
    void loadStoreSettings().catch(() => undefined);
    return { settings: cached ?? defaultStoreSettings, ready: cached !== null };
  });

  useEffect(() => {
    let active = true;
    loadStoreSettings().then(
      (settings) => active && setState({ settings, ready: true }),
      (error: unknown) => {
        console.error("Falha ao carregar as configurações da loja", error);
        if (active) setState((current) => ({ ...current, ready: true }));
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(() => toContact(state.settings), [state.settings]);
  return (
    <StoreSettingsReadyContext.Provider value={state.ready}>
      <StoreSettingsContext.Provider value={value}>{children}</StoreSettingsContext.Provider>
    </StoreSettingsReadyContext.Provider>
  );
}

export const useStoreSettingsReady = (): boolean => useContext(StoreSettingsReadyContext);

export function useStoreSettings(): StoreContact {
  return useContext(StoreSettingsContext);
}
