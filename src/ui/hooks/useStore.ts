import { useCallback, useState } from "react";
import { container } from "@/app/container";
import type { AccountFilter } from "@/application/ports";
import type { CheckoutData } from "@/application/schemas";
import {
  getAccount,
  getOrder,
  listAccounts,
  listTestimonials,
  placeOrder,
  type PlacedOrder,
} from "@/application/use-cases";
import { useAsync } from "./useAsync";

const { store } = container;

export function useAccounts(filter: AccountFilter) {
  return useAsync(() => listAccounts(store, filter), JSON.stringify(filter), { keepPrevious: true });
}

export function useAccount(slug: string) {
  return useAsync(() => getAccount(store, slug), slug);
}

export function useTestimonials() {
  return useAsync(() => listTestimonials(store), "testimonials");
}

export function useOrder(code: string) {
  // Recarrega sem piscar: a página do pedido confere o pagamento de tempos em tempos.
  return useAsync(() => getOrder(store, code), code, { keepPrevious: true });
}

type PlaceOrderState = { status: "idle" } | { status: "submitting" } | { status: "error"; message: string };

export function usePlaceOrder() {
  const [state, setState] = useState<PlaceOrderState>({ status: "idle" });

  const submit = useCallback(async (accountId: string, data: CheckoutData): Promise<PlacedOrder | null> => {
    setState({ status: "submitting" });
    try {
      const placed = await placeOrder(store, accountId, data);
      setState({ status: "idle" });
      return placed;
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Não foi possível concluir o pedido.";
      setState({ status: "error", message });
      return null;
    }
  }, []);

  return { state, submit };
}
