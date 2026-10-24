import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { container } from "@/app/container";
import { confirmCardReturn, startCardPayment } from "@/application/use-cases";

const { store } = container;

/** Abre o checkout de cartão da InfinitePay para uma parte do pedido. */
export function useCardCheckout() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback(async (orderCode: string, paymentId: string) => {
    setPending(true);
    setError(null);
    try {
      const url = await startCardPayment(store, orderCode, paymentId);
      window.location.assign(url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível abrir o pagamento no cartão.");
      setPending(false);
    }
  }, []);

  return { open, pending, error };
}

/** Parâmetros que a InfinitePay põe no endereço de volta (redirect_url). */
const RETURN_PARAMS = ["order_nsu", "transaction_nsu", "slug", "receipt_url", "capture_method"] as const;

/**
 * Na volta do checkout de cartão, confere o pagamento (sem esperar o webhook), limpa o endereço
 * e avisa para recarregar o pedido.
 */
export function useCardReturn(onSettled: () => void) {
  const [params, setParams] = useSearchParams();
  const [checking, setChecking] = useState(false);
  const handled = useRef(false);
  const orderNsu = params.get("order_nsu");
  const transactionNsu = params.get("transaction_nsu");
  const slug = params.get("slug");
  const receiptUrl = params.get("receipt_url");

  useEffect(() => {
    if (handled.current || !orderNsu || !transactionNsu || !slug) return;
    handled.current = true;
    setChecking(true);
    confirmCardReturn(store, { orderNsu, transactionNsu, slug, receiptUrl })
      .catch((reason: unknown) => console.error("Falha ao conferir a volta do cartão", reason))
      .finally(() => {
        setChecking(false);
        setParams(
          (current) => {
            const next = new URLSearchParams(current);
            for (const key of RETURN_PARAMS) next.delete(key);
            return next;
          },
          { replace: true },
        );
        onSettled();
      });
  }, [orderNsu, transactionNsu, slug, receiptUrl, setParams, onSettled]);

  return { checking };
}
