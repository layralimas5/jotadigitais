import { useCallback, useEffect, useRef, useState } from "react";
import { getMessageTemplates, type AdminDeps } from "@/application/admin-use-cases";
import { DEFAULT_MESSAGE_TEMPLATES, type MessageTemplates } from "@/domain/message-template";
import { useAsync } from "@/ui/hooks/useAsync";
import { useAdminView } from "./admin-view";

/** Leitura do painel. `reload` busca de novo sem apagar o que já está na tela. */
export function useAdminQuery<T>(load: (deps: AdminDeps) => Promise<T>, key: string) {
  const { deps, previewing } = useAdminView();
  // Entrar ou sair do modo visualização busca tudo de novo, com ou sem máscara.
  const state = useAsync(() => load(deps), previewing ? `${key}:preview` : key, { keepPrevious: true });
  return { ...state, reload: state.retry };
}

/** Modelos de mensagem da Automação. Enquanto carregam (ou se falharem), valem os textos padrão. */
export function useMessageTemplates(): MessageTemplates {
  const state = useAdminQuery(getMessageTemplates, "message-templates");
  return state.status === "success" ? state.data : DEFAULT_MESSAGE_TEMPLATES;
}

/** Busca de novo a cada `intervalMs` e quando a aba volta a ficar visível (conversa do suporte, contadores). */
export function usePolling(refresh: () => void, intervalMs: number) {
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  });
  useEffect(() => {
    const timer = window.setInterval(() => refreshRef.current(), intervalMs);
    const onVisible = () => document.visibilityState === "visible" && refreshRef.current();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs]);
}

type MutationState = { status: "idle" } | { status: "pending" } | { status: "error"; error: Error };

function toError(reason: unknown): Error {
  return reason instanceof Error ? reason : new Error("Algo deu errado. Tente novamente.");
}

/** Gravação do painel com estado de envio e erro. Devolve `undefined` quando falha (o erro fica no estado). */
export function useMutation<A extends unknown[], R>(action: (deps: AdminDeps, ...args: A) => Promise<R>) {
  const [state, setState] = useState<MutationState>({ status: "idle" });
  const { deps } = useAdminView();
  const actionRef = useRef(action);
  const depsRef = useRef(deps);
  const mounted = useRef(true);

  useEffect(() => {
    actionRef.current = action;
    depsRef.current = deps;
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
      const result = await actionRef.current(depsRef.current, ...args);
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
