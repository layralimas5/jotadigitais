import type { Order } from "@/domain/order";
import type { OrderRepository } from "@/application/ports";

const STORAGE_KEY = "jota:orders";

function readAll(): Record<string, Order> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Order>) : {};
  } catch (error) {
    console.error("Falha ao ler pedidos salvos", error);
    return {};
  }
}

/** Guarda pedidos no navegador enquanto o backend não existe. */
export class LocalStorageOrderRepository implements OrderRepository {
  async save(order: Order): Promise<void> {
    const orders = readAll();
    orders[order.code] = order;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  }

  async findByCode(code: string): Promise<Order | null> {
    return readAll()[code] ?? null;
  }
}
