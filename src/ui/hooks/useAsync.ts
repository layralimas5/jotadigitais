import { useCallback, useEffect, useState } from "react";

export type AsyncState<T> =
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: Error };

interface UseAsyncOptions {
  /** Mantém o último resultado na tela enquanto recarrega (evita piscar ao filtrar). */
  keepPrevious?: boolean;
}

function toError(reason: unknown): Error {
  return reason instanceof Error ? reason : new Error("Algo deu errado. Tente novamente.");
}

export function useAsync<T>(
  load: () => Promise<T>,
  key: string,
  { keepPrevious = false }: UseAsyncOptions = {},
): AsyncState<T> & { retry: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((previous) =>
      previous.status === "loading" || (keepPrevious && previous.status === "success") ? previous : { status: "loading" },
    );
    load().then(
      (data) => !cancelled && setState({ status: "success", data }),
      (reason: unknown) => {
        if (cancelled) return;
        console.error(reason);
        setState({ status: "error", error: toError(reason) });
      },
    );
    return () => {
      cancelled = true;
    };
    // `load` muda a cada render; a identidade da leitura é dada por `key`.
  }, [key, attempt, keepPrevious]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { ...state, retry };
}
