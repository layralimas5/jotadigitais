import { useCallback, useEffect, useRef, useState } from "react";
import { useAdminView } from "../admin-view";
import { dismissNotifications, loadNotifications } from "@/application/workspace-use-cases";
import type { AppNotification } from "@/domain/notification";
import { playPlim, plimEnabled } from "../pwa/plim";
import { usePushReceived } from "../pwa/usePanelApp";

const REFRESH_MS = 60_000;

type State = { status: "loading" } | { status: "ready"; items: AppNotification[] } | { status: "error" };

/**
 * Toca o "plim" quando aparece aviso guardado no banco que não estava na leitura anterior.
 * A primeira leitura só memoriza (abrir o painel não toca); lembretes calculados na hora não tocam.
 */
function useNewNotificationChime() {
  const known = useRef<Set<string> | null>(null);
  return useCallback((items: readonly AppNotification[]) => {
    const keys = items.filter((item) => item.kind !== "reminder").map((item) => item.key);
    const previous = known.current;
    if (previous && keys.some((key) => !previous.has(key)) && plimEnabled()) playPlim();
    known.current = new Set([...(previous ?? []), ...keys]);
  }, []);
}

/**
 * Notificações do sininho. Atualiza sozinho a cada minuto e quando a aba volta a ficar visível.
 * Apagar some na hora da tela; se o servidor recusar, o aviso volta e `onError` é chamado.
 */
export function useNotifications(onError: (message: string) => void) {
  const { deps, viewAccess } = useAdminView();
  const [state, setState] = useState<State>({ status: "loading" });
  const mounted = useRef(true);
  const onErrorRef = useRef(onError);
  const chimeOnNew = useNewNotificationChime();

  useEffect(() => {
    onErrorRef.current = onError;
  });

  const refresh = useCallback(async () => {
    try {
      const items = await loadNotifications(deps, viewAccess);
      chimeOnNew(items);
      if (mounted.current) setState({ status: "ready", items });
    } catch (error) {
      console.error("Falha ao carregar as notificações", error);
      if (mounted.current) setState((current) => (current.status === "ready" ? current : { status: "error" }));
    }
  }, [deps, viewAccess]);

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

  usePushReceived(() => void refresh());

  const dismiss = useCallback(
    async (keys: readonly string[]) => {
      if (state.status !== "ready" || keys.length === 0) return;
      const previous = state.items;
      setState({ status: "ready", items: previous.filter((item) => !keys.includes(item.key)) });
      try {
        await dismissNotifications(deps, keys);
      } catch (error) {
        console.error("Falha ao apagar notificação", error);
        if (mounted.current) setState({ status: "ready", items: previous });
        onErrorRef.current("Não foi possível apagar agora. Tente de novo.");
      }
    },
    [state, deps],
  );

  return { state, refresh, dismiss };
}
