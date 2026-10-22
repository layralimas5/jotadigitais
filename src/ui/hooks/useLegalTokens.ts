import { useMemo } from "react";
import { LEGAL_CONTROLLER } from "@/application/legal-documents";
import type { LegalTokenValues } from "@/domain/legal/legal-document";
import { useStoreSettings } from "./useStoreSettings";

/** Dados do controlador (fixos na versão do documento) e da loja (prazo de garantia e @, que mudam pelo painel). */
export function useLegalTokens(): LegalTokenValues {
  const { guaranteeDays, instagramHandle } = useStoreSettings();
  return useMemo(
    () => ({ ...LEGAL_CONTROLLER, guaranteeDays: String(guaranteeDays), instagram: instagramHandle }),
    [guaranteeDays, instagramHandle],
  );
}
