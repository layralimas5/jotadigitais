import type { Account, AccountData } from "@/domain/account";
import type { CustomerRecord, CustomerRecordData } from "@/domain/customer";
import type { Expense, ExpenseData } from "@/domain/finance";
import type { Lead, LeadData, LeadStage } from "@/domain/lead";
import type { MessageTemplates } from "@/domain/message-template";
import type { Customer, Order, OrderStatus, PaymentMethod } from "@/domain/order";
import type { Platform } from "@/domain/platform";
import type { StoreSettings } from "@/domain/store-settings";
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

export interface StoreSettingsRepository {
  get(): Promise<StoreSettings>;
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
  changePassword(newPassword: string): Promise<void>;
  onChange(listener: (session: AdminSession | null) => void): () => void;
}

export interface AdminStoreSettingsRepository extends StoreSettingsRepository {
  save(settings: StoreSettings): Promise<StoreSettings>;
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

export interface AdminCustomerRepository {
  listAll(): Promise<CustomerRecord[]>;
  findById(id: string): Promise<CustomerRecord | null>;
  create(data: CustomerRecordData): Promise<CustomerRecord>;
  update(id: string, data: CustomerRecordData): Promise<CustomerRecord>;
  remove(id: string): Promise<void>;
}

export interface AdminMessageTemplateRepository {
  /** Sempre devolve os cinco modelos: o que não foi salvo vem com o texto padrão. */
  getAll(): Promise<MessageTemplates>;
  save(templates: MessageTemplates): Promise<MessageTemplates>;
}

export const ADMIN_PREFERENCE_KEYS = ["crm_stage_order"] as const;
export type AdminPreferenceKey = (typeof ADMIN_PREFERENCE_KEYS)[number];

/** Preferências de tela do painel, guardadas no banco para valer em qualquer aparelho. */
export interface AdminPreferenceRepository {
  get(key: AdminPreferenceKey): Promise<unknown>;
  set(key: AdminPreferenceKey, value: unknown): Promise<void>;
}

export interface AdminExpenseRepository {
  listAll(): Promise<Expense[]>;
  findById(id: string): Promise<Expense | null>;
  create(data: ExpenseData): Promise<Expense>;
  update(id: string, data: ExpenseData): Promise<Expense>;
  remove(id: string): Promise<void>;
}

export interface AdminLeadRepository {
  listAll(): Promise<Lead[]>;
  findById(id: string): Promise<Lead | null>;
  create(data: LeadData): Promise<Lead>;
  update(id: string, data: LeadData): Promise<Lead>;
  moveToStage(id: string, stage: LeadStage): Promise<void>;
  remove(id: string): Promise<void>;
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
