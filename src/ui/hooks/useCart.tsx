import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { MAX_CART_ITEMS } from "@/domain/order";

/** O carrinho fica só neste navegador: são os ids das contas, sem preço (o preço sempre vem do banco). */
const STORAGE_KEY = "jota:cart";

function parseIds(raw: string | null): string[] {
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  const ids = parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
  return [...new Set(ids)].slice(0, MAX_CART_ITEMS);
}

function readStoredIds(): string[] {
  try {
    return parseIds(window.localStorage.getItem(STORAGE_KEY));
  } catch (error) {
    console.warn("Carrinho salvo ilegível ou bloqueado; começando vazio.", error);
    return [];
  }
}

function storeIds(ids: readonly string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch (error) {
    // Navegador sem armazenamento (aba anônima, por exemplo): o carrinho vale só enquanto a página estiver aberta.
    console.warn("Não foi possível guardar o carrinho neste navegador.", error);
  }
}

export interface CartController {
  ids: readonly string[];
  count: number;
  /** Chegou ao limite de contas por pedido. */
  full: boolean;
  has: (id: string) => boolean;
  add: (id: string) => void;
  remove: (id: string) => void;
  /** Tira do carrinho as contas compradas (ou todas, sem argumento). */
  clear: (ids?: readonly string[]) => void;
}

const CartContext = createContext<CartController | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>(readStoredIds);
  const [announcement, setAnnouncement] = useState("");

  // Outra aba mexeu no carrinho: esta acompanha.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setIds(readStoredIds());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const update = useCallback((next: (current: string[]) => string[], message: string) => {
    setIds((current) => {
      const updated = next(current);
      storeIds(updated);
      return updated;
    });
    setAnnouncement(message);
  }, []);

  const add = useCallback(
    (id: string) =>
      update(
        (current) => (current.includes(id) || current.length >= MAX_CART_ITEMS ? current : [...current, id]),
        "Conta adicionada ao carrinho.",
      ),
    [update],
  );

  const remove = useCallback(
    (id: string) => update((current) => current.filter((item) => item !== id), "Conta removida do carrinho."),
    [update],
  );

  const clear = useCallback(
    (bought?: readonly string[]) =>
      update((current) => (bought ? current.filter((item) => !bought.includes(item)) : []), "Carrinho esvaziado."),
    [update],
  );

  const value = useMemo<CartController>(
    () => ({
      ids,
      count: ids.length,
      full: ids.length >= MAX_CART_ITEMS,
      has: (id) => ids.includes(id),
      add,
      remove,
      clear,
    }),
    [ids, add, remove, clear],
  );

  return (
    <CartContext.Provider value={value}>
      {children}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </CartContext.Provider>
  );
}

/** Nulo fora da loja (a prévia do card no painel não tem carrinho). */
export function useOptionalCart(): CartController | null {
  return useContext(CartContext);
}

export function useCart(): CartController {
  const cart = useContext(CartContext);
  if (!cart) throw new Error("useCart precisa estar dentro do CartProvider.");
  return cart;
}
