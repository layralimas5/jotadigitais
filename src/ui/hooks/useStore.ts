import { useCallback, useMemo, useState } from "react";
import { container } from "@/app/container";
import type { AccountFilter } from "@/application/ports";
import type { CheckoutData } from "@/application/schemas";
import {
  getAccount,
  getCartAccounts,
  getOrder,
  listAccounts,
  listStockCountries,
  listTestimonials,
  placeOrder,
  type PlacedOrder,
} from "@/application/use-cases";
import { isShownInStorefront } from "@/domain/storefront";
import { useStorefrontVisibility } from "@/ui/components/stock-alert/StorefrontClosed";
import { attachStoredAffiliateClick } from "./useAffiliateRef";
import { useAsync } from "./useAsync";

const { store } = container;

/** Contas da vitrine, sem os tipos de estoque que o Jota tirou do site. */
export function useAccounts(filter: AccountFilter) {
  const state = useAsync(() => listAccounts(store, filter), JSON.stringify(filter), { keepPrevious: true });
  const visibility = useStorefrontVisibility();
  const hiddenKey = `${visibility.closed}:${visibility.hiddenCategories.join(",")}`;
  // hiddenKey resume a visibilidade: o objeto muda a cada render, a chave só quando o Jota muda a vitrine.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => (state.status === "success" ? { ...state, data: state.data.filter((account) => isShownInStorefront(visibility, account)) } : state), [state, hiddenKey]);
}

export function useAccount(slug: string) {
  return useAsync(() => getAccount(store, slug), slug);
}

/** Contas guardadas no carrinho, na ordem em que entraram. */
export function useCartAccounts(ids: readonly string[]) {
  return useAsync(() => getCartAccounts(store, ids), `cart:${ids.join(",")}`, { keepPrevious: true });
}

/** Países que têm conta na vitrine (filtro). */
export function useStockCountries() {
  return useAsync(() => listStockCountries(store), "stock-countries");
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

  const submit = useCallback(async (accountIds: string[], data: CheckoutData): Promise<PlacedOrder | null> => {
    setState({ status: "submitting" });
    try {
      const placed = await placeOrder(store, accountIds, data);
      await attachStoredAffiliateClick(placed.order.code);
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
