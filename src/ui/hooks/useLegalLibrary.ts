import { useEffect, useState } from "react";
import { container } from "@/app/container";
import { BUNDLED_LEGAL_LIBRARY, loadLegalLibrary } from "@/application/legal-documents";
import type { LegalLibrary } from "@/domain/legal/legal-editing";

let loading: Promise<LegalLibrary> | null = null;

/** Termos e Política publicados. Até o banco responder (ou se falhar), vale o texto original, sem piscar a página. */
export function useLegalLibrary(): LegalLibrary {
  const [library, setLibrary] = useState<LegalLibrary>(BUNDLED_LEGAL_LIBRARY);

  useEffect(() => {
    let active = true;
    loading ??= loadLegalLibrary(container.store);
    loading.then(
      (loaded) => active && setLibrary(loaded),
      (error: unknown) => {
        loading = null;
        console.error("Falha ao carregar os Termos e a Política publicados", error);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  return library;
}
