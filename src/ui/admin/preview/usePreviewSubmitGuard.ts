import { useEffect, type RefObject } from "react";
import { PreviewReadOnlyError } from "@/domain/errors";
import { useToast } from "../toast";

/**
 * No modo visualização nenhum formulário chega a enviar: o envio é parado antes do React
 * (fase de captura) e aparece o aviso. Sem isso, os dados mascarados cairiam na validação
 * com mensagens que confundem ("e-mail inválido") em vez de dizer que ali nada é salvo.
 */
export function usePreviewSubmitGuard(active: boolean, containerRef: RefObject<HTMLElement | null>) {
  const toast = useToast();
  useEffect(() => {
    const container = containerRef.current;
    if (!active || !container) return;
    const block = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      toast.show(new PreviewReadOnlyError().message, "error");
    };
    container.addEventListener("submit", block, true);
    return () => container.removeEventListener("submit", block, true);
  }, [active, containerRef, toast]);
}
