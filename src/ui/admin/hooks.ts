import { useCallback, useEffect, useRef, useState } from "react";
import { container } from "@/app/container";
import type { AdminDeps } from "@/application/admin-use-cases";
import { useAsync } from "@/ui/hooks/useAsync";

const { admin } = container;

/** Leitura do painel. `reload` busca de novo sem apagar o que já está na tela. */
export function useAdminQuery<T>(load: (deps: AdminDeps) => Promise<T>, key: string) {
  const state = useAsync(() => load(admin), key, { keepPrevious: true });
  return { ...state, reload: state.retry };
}

type MutationState = { status: "idle" } | { status: "pending" } | { status: "error"; error: Error };

function toError(reason: unknown): Error {
  return reason instanceof Error ? reason : new Error("Algo deu errado. Tente novamente.");
}

/** Gravação do painel com estado de envio e erro. Devolve `undefined` quando falha (o erro fica no estado). */
export function useMutation<A extends unknown[], R>(action: (deps: AdminDeps, ...args: A) => Promise<R>) {
  const [state, setState] = useState<MutationState>({ status: "idle" });
  const actionRef = useRef(action);
  const mounted = useRef(true);

  useEffect(() => {
    actionRef.current = action;
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (...args: A): Promise<R | undefined> => {
    setState({ status: "pending" });
    try {
      const result = await actionRef.current(admin, ...args);
      if (mounted.current) setState({ status: "idle" });
      return result;
    } catch (reason) {
      console.error(reason);
      if (mounted.current) setState({ status: "error", error: toError(reason) });
      return undefined;
    }
  }, []);

  const reset = useCallback(() => setState({ status: "idle" }), []);

  return {
    run,
    reset,
    pending: state.status === "pending",
    error: state.status === "error" ? state.error : null,
  };
}
