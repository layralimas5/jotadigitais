import { useCallback, useState } from "react";
import { container } from "@/app/container";
import { ValidationError } from "@/application/schemas";
import { subscribeStockAlert } from "@/application/use-cases";

export type StockAlertState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "done" }
  | { status: "error"; message: string; fieldErrors: Record<string, string> };

/** Inscrição na lista de espera de conta nova. */
export function useStockAlert() {
  const [state, setState] = useState<StockAlertState>({ status: "idle" });

  const submit = useCallback(async (raw: unknown) => {
    setState({ status: "submitting" });
    try {
      await subscribeStockAlert(container.store, raw);
      setState({ status: "done" });
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Não foi possível salvar. Tente de novo.";
      setState({ status: "error", message, fieldErrors: error instanceof ValidationError ? error.fieldErrors : {} });
    }
  }, []);

  const reset = useCallback(() => setState({ status: "idle" }), []);

  return { state, submit, reset };
}
