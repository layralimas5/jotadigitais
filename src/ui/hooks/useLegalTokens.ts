import { useMemo } from "react";
import type { LegalController, LegalTokenValues } from "@/domain/legal/legal-document";
import { useStoreSettings } from "./useStoreSettings";

/** Dados do controlador (fixos na versão do documento) e da loja (prazo de garantia e @, que mudam pelo painel). */
export function useLegalTokens(controller: LegalController): LegalTokenValues {
  const { guaranteeDays, instagramHandle } = useStoreSettings();
  return useMemo(
    () => ({ ...controller, guaranteeDays: String(guaranteeDays), instagram: instagramHandle }),
    [controller, guaranteeDays, instagramHandle],
  );
}
