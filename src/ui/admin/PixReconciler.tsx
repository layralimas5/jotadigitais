import { useCallback, useEffect, useRef } from "react";
import { container } from "@/app/container";
import { reconcilePendingPix } from "@/application/admin-use-cases";
import { useAdminView } from "./admin-view";
import { usePolling } from "./hooks";
import { useToast } from "./toast";

const CHECK_EVERY_MS = 60_000;

/** Avisa as telas abertas (Pedidos, Dashboard) para buscar de novo depois que um Pix foi confirmado aqui. */
export const PIX_CONFIRMED_EVENT = "jota:pix-confirmed";

/**
 * Rede de segurança do Pix do C6: com o painel aberto, confere a cada minuto os Pix pendentes no C6.
 * Cobre o cliente que pagou pelo QR e fechou a página quando o aviso do C6 não chega.
 * Só no painel de quem cuida de Pedidos, nunca no "ver como" ou no ambiente de teste.
 */
export function PixReconciler({ enabled }: { enabled: boolean }) {
  const { deps, mode } = useAdminView();
  const toast = useToast();
  const running = useRef(false);
  const active = enabled && mode === "self";

  const check = useCallback(async () => {
    if (!active || running.current || document.visibilityState !== "visible") return;
    running.current = true;
    try {
      const confirmed = await reconcilePendingPix(deps, container.store.payments);
      if (confirmed.length === 0) return;
      toast.show(
        confirmed.length === 1
          ? `Pix do pedido ${confirmed[0]} confirmado no C6.`
          : `Pix de ${confirmed.length} pedidos confirmado no C6: ${confirmed.join(", ")}.`,
      );
      window.dispatchEvent(new CustomEvent(PIX_CONFIRMED_EVENT, { detail: confirmed }));
    } catch (error) {
      console.error("Falha ao conferir os Pix pendentes no C6", error);
    } finally {
      running.current = false;
    }
  }, [active, deps, toast]);

  useEffect(() => {
    void check();
  }, [check]);
  usePolling(() => void check(), CHECK_EVERY_MS);

  return null;
}
