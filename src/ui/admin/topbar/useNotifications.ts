import { useCallback, useEffect, useRef, useState } from "react";
import { container } from "@/app/container";
import { dismissNotifications, loadNotifications } from "@/application/workspace-use-cases";
import type { AppNotification } from "@/domain/notification";

const REFRESH_MS = 60_000;

type State = { status: "loading" } | { status: "ready"; items: AppNotification[] } | { status: "error" };

/**
 * Notificações do sininho. Atualiza sozinho a cada minuto e quando a aba volta a ficar visível.
 * Apagar some na hora da tela; se o servidor recusar, o aviso volta e `onError` é chamado.
 */
export function useNotifications(onError: (message: string) => void) {
  const [state, setState] = useState<State>({ status: "loading" });
  const mounted = useRef(true);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onErrorRef.current = onError;
  });

  const refresh = useCallback(async () => {
    try {
      const items = await loadNotifications(container.admin);
      if (mounted.current) setState({ status: "ready", items });
    } catch (error) {
      console.error("Falha ao carregar as notificações", error);
      if (mounted.current) setState((current) => (current.status === "ready" ? current : { status: "error" }));
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const timer = window.setInterval(() => void refresh(), REFRESH_MS);
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const dismiss = useCallback(
    async (keys: readonly string[]) => {
      if (state.status !== "ready" || keys.length === 0) return;
      const previous = state.items;
      setState({ status: "ready", items: previous.filter((item) => !keys.includes(item.key)) });
      try {
        await dismissNotifications(container.admin, keys);
      } catch (error) {
        console.error("Falha ao apagar notificação", error);
        if (mounted.current) setState({ status: "ready", items: previous });
        onErrorRef.current("Não foi possível apagar agora. Tente de novo.");
      }
    },
    [state],
  );

  return { state, refresh, dismiss };
}
