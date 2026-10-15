import type { Account } from "@/domain/account";
import type { AdminUser } from "@/domain/admin-user";
import type { CustomerRecord } from "@/domain/customer";
import type { Expense } from "@/domain/finance";
import type { Lead } from "@/domain/lead";
import type { MessageTemplates } from "@/domain/message-template";
import type { Order } from "@/domain/order";
import type { Partner } from "@/domain/partner";
import type { StoreSettings } from "@/domain/store-settings";
import type { Testimonial } from "@/domain/testimonial";
import { SEED_ACCOUNTS, SEED_TESTIMONIALS } from "./seed";

const STORAGE_KEY = "jota:demo-db";
const SCHEMA_VERSION = 2;

export interface DemoState {
  version: number;
  accounts: Account[];
  testimonials: Testimonial[];
  /** Pedidos com o e-mail completo, como o banco guardaria. */
  orders: Order[];
  /** Opcionais para não apagar o estoque de quem já usava o painel antes destas partes existirem. */
  settings?: StoreSettings;
  leads?: Lead[];
  customers?: CustomerRecord[];
  messageTemplates?: Partial<MessageTemplates>;
  preferences?: Record<string, unknown>;
  expenses?: Expense[];
  partners?: Partner[];
  adminUsers?: AdminUser[];
}

function seedState(): DemoState {
  return {
    version: SCHEMA_VERSION,
    accounts: structuredClone(SEED_ACCOUNTS),
    testimonials: structuredClone(SEED_TESTIMONIALS),
    orders: [],
  };
}

function isDemoState(value: unknown): value is DemoState {
  if (typeof value !== "object" || value === null) return false;
  const state = value as Partial<DemoState>;
  return (
    state.version === SCHEMA_VERSION &&
    Array.isArray(state.accounts) &&
    Array.isArray(state.testimonials) &&
    Array.isArray(state.orders)
  );
}

export class StorageFullError extends Error {
  constructor() {
    super("O armazenamento do navegador encheu. No modo demonstração, use imagens menores ou apague algumas.");
    this.name = "StorageFullError";
  }
}

/**
 * Banco do modo demonstração: tudo fica no localStorage deste navegador.
 * O painel e o site leem a mesma chave, então o que o admin salva aparece na vitrine na hora.
 */
export class DemoDatabase {
  read(): DemoState {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (isDemoState(parsed)) return parsed;
        console.warn("Dados de demonstração em formato antigo; recomeçando do estoque inicial.");
      }
    } catch (error) {
      console.error("Falha ao ler os dados de demonstração", error);
    }
    return seedState();
  }

  write<T>(mutate: (state: DemoState) => T): T {
    const state = this.read();
    const result = mutate(state);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      if (error instanceof DOMException && error.name === "QuotaExceededError") throw new StorageFullError();
      throw error;
    }
    return result;
  }
}

const SIMULATED_LATENCY_MS = 200;

export const simulateLatency = () => new Promise((resolve) => setTimeout(resolve, SIMULATED_LATENCY_MS));

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}
