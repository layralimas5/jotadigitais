import type { Account, AccountData } from "@/domain/account";
import type { AdminUser, NewAdminUser } from "@/domain/admin-user";
import type { CalendarConnection, CalendarEvent, CalendarEventDraft, UpsertResult } from "@/domain/calendar";
import type { CustomerRecord, CustomerRecordData } from "@/domain/customer";
import type { Expense, ExpenseData, Revenue, RevenueData } from "@/domain/finance";
import type { Lead, LeadData, LeadStage } from "@/domain/lead";
import type { MessageTemplates } from "@/domain/message-template";
import type { StoredNotification } from "@/domain/notification";
import type { Customer, Order, OrderStatus, PaymentMethod } from "@/domain/order";
import type { Partner, PartnerData } from "@/domain/partner";
import type { Platform } from "@/domain/platform";
import type { ProfileLookup } from "@/domain/profile-lookup";
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
  name: string | null;
  /** Entrou pelo link de "esqueci a senha": cria a senha nova sem informar a atual. */
  recoveringPassword: boolean;
}

export interface ProfileUpdate {
  name: string;
  email: string;
}

export interface ProfileUpdateResult {
  /** O e-mail novo só vale depois que a pessoa clica no link de confirmação. */
  emailConfirmationPending: boolean;
}

export interface AuthService {
  getSession(): Promise<AdminSession | null>;
  signIn(email: string, password: string): Promise<AdminSession>;
  signOut(): Promise<void>;
  /** Confere a senha atual. Falha com `WrongCurrentPasswordError`. */
  verifyPassword(email: string, password: string): Promise<void>;
  changePassword(newPassword: string): Promise<void>;
  requestPasswordReset(email: string, redirectTo: string): Promise<void>;
  updateProfile(update: ProfileUpdate, emailRedirectTo: string): Promise<ProfileUpdateResult>;
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

export const ADMIN_PREFERENCE_KEYS = ["crm_stage_order", "google_calendar"] as const;
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

export interface AdminRevenueRepository {
  listAll(): Promise<Revenue[]>;
  findById(id: string): Promise<Revenue | null>;
  create(data: RevenueData): Promise<Revenue>;
  update(id: string, data: RevenueData): Promise<Revenue>;
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

export interface AdminPartnerRepository {
  listAll(): Promise<Partner[]>;
  findById(id: string): Promise<Partner | null>;
  create(data: PartnerData): Promise<Partner>;
  update(id: string, data: PartnerData): Promise<Partner>;
  /** As contas do parceiro ficam sem parceiro (viram da loja); vendas e pedidos não mudam. */
  remove(id: string): Promise<void>;
}

/** Quem entra no sistema. Criar e remover passam pelo servidor, que confere se quem pede é administrador. */
export interface AdminUserRepository {
  listAll(): Promise<AdminUser[]>;
  create(input: NewAdminUser): Promise<AdminUser>;
  remove(id: string): Promise<void>;
}

/** Lê os números públicos de um perfil pelo link. Falha com `ProfileLookupError`. */
export interface ProfileLookupService {
  lookup(url: string): Promise<ProfileLookup>;
}

/** Notificações do sininho guardadas no banco, e o que cada usuário já apagou. */
export interface AdminNotificationRepository {
  listRecent(): Promise<StoredNotification[]>;
  listDismissed(): Promise<string[]>;
  dismiss(keys: readonly string[]): Promise<void>;
}

/**
 * Google Agenda. O acesso é dado pelo próprio Jota na janela do Google e fica só na memória do navegador;
 * a cada visita ele abre a agenda com um clique. Falha com `CalendarError`.
 */
export interface CalendarService {
  /** Falso enquanto o sistema não tiver o ID do app do Google configurado. */
  readonly configured: boolean;
  /** Já tem acesso liberado nesta visita. */
  hasAccess(): boolean;
  /** Carrega o login do Google antes do clique: a janela só abre se vier direto de um clique. */
  prepare(): Promise<void>;
  connect(): Promise<CalendarConnection>;
  disconnect(): Promise<void>;
  upcoming(days: number): Promise<CalendarEvent[]>;
  upsertAllDayEvent(draft: CalendarEventDraft): Promise<UpsertResult>;
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
