import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { container } from "@/app/container";
import { defaultStoreSettings } from "@/app/config";
import { getStoreSettings } from "@/application/use-cases";
import { instagramUrlOf, whatsappUrlOf, type StoreSettings } from "@/domain/store-settings";

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

/** Carrega uma vez as configurações salvas no painel. Até chegarem (ou se falharem), o site usa os valores padrão. */
export function StoreSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<StoreSettings>(defaultStoreSettings);

  useEffect(() => {
    let active = true;
    getStoreSettings(container.store).then(
      (loaded) => active && setSettings(loaded),
      (error: unknown) => console.error("Falha ao carregar as configurações da loja", error),
    );
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(() => toContact(settings), [settings]);
  return <StoreSettingsContext.Provider value={value}>{children}</StoreSettingsContext.Provider>;
}

export function useStoreSettings(): StoreContact {
  return useContext(StoreSettingsContext);
}
