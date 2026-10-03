import { useCallback, useState } from "react";
import { container } from "@/app/container";
import type { AccountFilter } from "@/application/ports";
import type { CheckoutData } from "@/application/schemas";
import { getAccount, getOrder, listAccounts, placeOrder, type PlacedOrder } from "@/application/use-cases";
import { useAsync } from "./useAsync";

export function useAccounts(filter: AccountFilter) {
  return useAsync(() => listAccounts(container, filter), JSON.stringify(filter), { keepPrevious: true });
}

export function useAccount(slug: string) {
  return useAsync(() => getAccount(container, slug), slug);
}

export function useOrder(code: string) {
  return useAsync(() => getOrder(container, code), code);
}

type PlaceOrderState = { status: "idle" } | { status: "submitting" } | { status: "error"; message: string };

export function usePlaceOrder() {
  const [state, setState] = useState<PlaceOrderState>({ status: "idle" });

  const submit = useCallback(async (accountId: string, data: CheckoutData): Promise<PlacedOrder | null> => {
    setState({ status: "submitting" });
    try {
      const placed = await placeOrder(container, accountId, data);
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
