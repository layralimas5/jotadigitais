import type { Account, AccountData } from "@/domain/account";
import type { Customer, Order, OrderStatus, PaymentMethod } from "@/domain/order";
import type { Platform } from "@/domain/platform";
import type { Testimonial, TestimonialData } from "@/domain/testimonial";

// ---------------------------------------------------------------------------
// Loja (site público)
// ---------------------------------------------------------------------------

export type AccountSort = "recent" | "price-asc" | "followers-desc";

export interface AccountFilter {
  query?: string;
  platform?: Platform;
  minFollowers?: number;
  maxFollowers?: number;
  sort?: AccountSort;
  onlyAvailable?: boolean;
}

export interface AccountRepository {
  list(filter: AccountFilter): Promise<Account[]>;
  findBySlug(slug: string): Promise<Account | null>;
  findById(id: string): Promise<Account | null>;
}

export interface TestimonialRepository {
  listPublished(): Promise<Testimonial[]>;
}

export interface NewOrder {
  accountId: string;
  customer: Customer;
  paymentMethod: PaymentMethod;
}

export interface OrderRepository {
  /** Cria o pedido e reserva a conta numa operação só. Falha se a conta já estiver reservada ou vendida. */
  place(input: NewOrder): Promise<Order>;
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

// ---------------------------------------------------------------------------
// Painel administrativo
// ---------------------------------------------------------------------------

export interface AdminSession {
  email: string;
}

export interface AuthService {
  getSession(): Promise<AdminSession | null>;
  signIn(email: string, password: string): Promise<AdminSession>;
  signOut(): Promise<void>;
  onChange(listener: (session: AdminSession | null) => void): () => void;
}

export interface AdminAccountRepository {
  listAll(): Promise<Account[]>;
  findById(id: string): Promise<Account | null>;
  create(data: AccountData): Promise<Account>;
  update(id: string, data: AccountData): Promise<Account>;
  remove(id: string): Promise<void>;
}

export interface AdminTestimonialRepository {
  listAll(): Promise<Testimonial[]>;
  findById(id: string): Promise<Testimonial | null>;
  create(data: TestimonialData): Promise<Testimonial>;
  update(id: string, data: TestimonialData): Promise<Testimonial>;
  remove(id: string): Promise<void>;
  /** Grava a ordem de exibição: o primeiro id aparece primeiro no site. */
  reorder(ids: string[]): Promise<void>;
}

export interface AdminOrderRepository {
  listAll(): Promise<Order[]>;
  updateStatus(code: string, status: OrderStatus): Promise<void>;
}

export type MediaFolder = "accounts" | "testimonials";

export interface PreparedImage {
  blob: Blob;
  width: number;
  height: number;
}

export interface UploadedImage {
  url: string;
  width: number;
  height: number;
}

export interface ImageStorage {
  upload(image: PreparedImage, folder: MediaFolder): Promise<UploadedImage>;
}
