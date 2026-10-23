import { useCallback } from "react";
import { useToast } from "../toast";

/** Copia para a área de transferência e avisa no toast, dando certo ou não. */
export function useCopy() {
  const toast = useToast();
  return useCallback(
    async (text: string, successMessage: string) => {
      try {
        await navigator.clipboard.writeText(text);
        toast.show(successMessage);
      } catch (error) {
        console.error("Não foi possível copiar", error);
        toast.show("Não foi possível copiar. Selecione o texto e copie manualmente.", "error");
      }
    },
    [toast],
  );
}
