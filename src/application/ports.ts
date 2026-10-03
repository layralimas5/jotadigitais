import type { Niche, TikTokAccount } from "@/domain/account";
import type { Order } from "@/domain/order";

export type AccountSort = "recent" | "price-asc" | "followers-desc";

export interface AccountFilter {
  query?: string;
  niche?: Niche;
  minFollowers?: number;
  maxFollowers?: number;
  sort?: AccountSort;
  onlyAvailable?: boolean;
}

export interface AccountRepository {
  list(filter: AccountFilter): Promise<TikTokAccount[]>;
  findBySlug(slug: string): Promise<TikTokAccount | null>;
  findById(id: string): Promise<TikTokAccount | null>;
}

export interface OrderRepository {
  save(order: Order): Promise<void>;
  findByCode(code: string): Promise<Order | null>;
}

export type PaymentCharge =
  | { kind: "pending_integration" }
  | { kind: "redirect"; url: string }
  | { kind: "pix"; qrCode: string; copyPaste: string; expiresAt: string };

/** Porta do gateway de pagamento. A implementação real (Pix/cartão) entra aqui sem mexer na UI. */
export interface PaymentGateway {
  createCharge(order: Order): Promise<PaymentCharge>;
}
