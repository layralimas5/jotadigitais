/**
 * Pedido esperando pagamento, guardado no navegador de quem comprou.
 * Quem sai para pagar no app do banco e volta para o site (ou fecha a aba) acha o caminho de volta para o pagamento.
 */
const STORAGE_KEY = "jota:pending-order";
const CHANGE_EVENT = "jota:pending-order";

export interface PendingOrder {
  code: string;
  expiresAt: string;
}

function isPendingOrder(value: unknown): value is PendingOrder {
  if (typeof value !== "object" || value === null) return false;
  const { code, expiresAt } = value as Record<string, unknown>;
  return typeof code === "string" && typeof expiresAt === "string" && !Number.isNaN(Date.parse(expiresAt));
}

/** O pedido guardado, se a reserva ainda vale. */
export function readPendingOrder(now = Date.now()): PendingOrder | null {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    return isPendingOrder(parsed) && Date.parse(parsed.expiresAt) > now ? parsed : null;
  } catch (error) {
    console.error("Não foi possível ler o pedido pendente", error);
    return null;
  }
}

function write(value: PendingOrder | null) {
  try {
    if (value) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch (error) {
    console.error("Não foi possível guardar o pedido pendente", error);
  }
}

export const savePendingOrder = (order: PendingOrder) => write(order);

/** Pago, cancelado ou vencido: o aviso some. Só apaga se for o mesmo pedido. */
export function clearPendingOrder(code: string) {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    if (isPendingOrder(parsed) && parsed.code === code) write(null);
  } catch (error) {
    console.error("Não foi possível limpar o pedido pendente", error);
  }
}

/** Avisa quem mostra o pedido pendente (outra aba muda pelo evento storage). */
export function subscribePendingOrder(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}
