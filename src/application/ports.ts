import type { Coupon, CouponData, CouponPreview } from "@/domain/coupon";
import type { CountryCode } from "@/domain/country";
import type { Account, AccountData } from "@/domain/account";
import type { AccessProfileUpdate, AccessUser } from "@/domain/access-user";
import type { AdminRole, AdminUser, AdminUserAccess, NewAdminUser, StaffPermission } from "@/domain/admin-user";
import type { CalendarConnection, CalendarEvent, CalendarEventDraft, UpsertResult } from "@/domain/calendar";
import type { CustomerRecord, CustomerRecordData } from "@/domain/customer";
import type { LegalConsent } from "@/domain/legal/legal-document";
import type { LegalPublishInput } from "@/domain/legal/legal-editing";
import type { Expense, ExpenseData, Revenue, RevenueData } from "@/domain/finance";
import type { Lead, LeadData, LeadStage } from "@/domain/lead";
import type { MessageTemplates } from "@/domain/message-template";
import type { StoredNotification } from "@/domain/notification";
import type { Customer, Order, OrderStatus, PaymentMethod } from "@/domain/order";
import type { EmailAccount, EmailAccountData, EmailAccountListItem } from "@/domain/email-account";
import type { Partner, PartnerData } from "@/domain/partner";
import type { Platform } from "@/domain/platform";
import type {
  AnonymizationResult,
  DataRequest,
  DataRequestAnswer,
  DataRequestKind,
  OpenedDataRequest,
  RetentionResult,
  SubjectData,
} from "@/domain/privacy";
import type { SiteContent } from "@/domain/site-content";
import type { ProfileLookup } from "@/domain/profile-lookup";
import type { StoreSettings } from "@/domain/store-settings";
import type {
  SupportLabel,
  SupportLabelData,
  SupportNotifyEvent,
  SupportReply,
  SupportStatus,
  SupportPriority,
  SupportSubmitResult,
  SupportTicket,
  SupportTicketData,
  SupportUpload,
} from "@/domain/support-ticket";
import type { Testimonial, TestimonialData } from "@/domain/testimonial";

// ---------------------------------------------------------------------------
// Loja (site público)
// ---------------------------------------------------------------------------

export type AccountSort = "recent" | "price-asc" | "followers-desc";

export interface AccountFilter {
  query?: string;
  platform?: Platform;
  country?: CountryCode;
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
  /** Uma conta (checkout normal) ou várias (carrinho, um pagamento só). */
  accountIds: string[];
  customer: Customer;
  paymentMethod: PaymentMethod;
  /** Valor do primeiro cartão quando o pagamento é dividido; o resto vai na segunda parte. */
  firstPartCents: number | null;
  /** Cupom digitado; o banco confere e calcula o desconto de novo. */
  couponCode: string | null;
  /** Termos de Uso e Política de Privacidade aceitos no checkout; o banco grava como prova. */
  consents: LegalConsent[];
}

/** Prévia do cupom no checkout: o banco confere e devolve o desconto sobre a soma das contas. */
export interface CouponService {
  preview(code: string, accountIds: string[]): Promise<CouponPreview>;
}

export interface AdminCouponRepository {
  listAll(): Promise<Coupon[]>;
  findById(id: string): Promise<Coupon | null>;
  create(data: CouponData): Promise<Coupon>;
  update(id: string, data: CouponData): Promise<Coupon>;
  remove(id: string): Promise<void>;
}

export interface OrderRepository {
  /**
   * Cria o pedido e reserva as contas numa operação só. Falha se alguma já estiver reservada ou vendida.
   * Com várias contas, devolve o pedido principal do carrinho.
   */
  place(input: NewOrder): Promise<Order>;
  findByCode(code: string): Promise<Order | null>;
}

/**
 * Meus dados: o titular prova que é dono de um pedido (e-mail ou WhatsApp + código).
 * Os dois métodos devolvem nulo quando contato e código não batem, e falham com
 * `TooManyPrivacyAttemptsError` quando há tentativas demais.
 */
export interface PrivacyService {
  lookup(contact: string, orderCode: string): Promise<SubjectData | null>;
  request(contact: string, orderCode: string, kind: DataRequestKind, details: string | null): Promise<OpenedDataRequest | null>;
}

/** Parâmetros que a InfinitePay põe no endereço de volta, depois do pagamento no cartão. */
export interface CardPaymentReturn {
  /** O id da parte do pedido (mandamos como order_nsu). */
  orderNsu: string;
  transactionNsu: string;
  slug: string;
  receiptUrl: string | null;
}

/** Cobrança no cartão (InfinitePay) e no Pix (C6 Bank). */
export interface PaymentGateway {
  /** Link do checkout de cartão para uma parte do pedido; reaproveita o link já criado. */
  cardCheckoutUrl(orderCode: string, paymentId: string): Promise<string>;
  /** Volta do checkout: confere na InfinitePay e marca a parte como paga. Devolve se ficou paga. */
  confirmCardReturn(payment: CardPaymentReturn): Promise<boolean>;
  /**
   * Copia e cola da cobrança Pix no C6 (reaproveita a já criada). Null quando o C6 não está disponível:
   * aí o site mostra o QR Code estático da chave e o Jota confirma à mão.
   */
  pixChargeCode(orderCode: string, paymentId: string): Promise<string | null>;
  /** Consulta a cobrança Pix no C6 e marca a parte como paga se o Pix caiu. Devolve se ficou paga. */
  checkPixPayment(orderCode: string, paymentId: string): Promise<boolean>;
}

export interface StoreSettingsRepository {
  get(): Promise<StoreSettings>;
}

/** Textos do site como foram salvos (ou nulo, se nunca foram editados). Quem lê junta com o padrão e valida. */
export interface SiteContentRepository {
  load(): Promise<unknown>;
}

/** Versão mais recente de cada documento legal, como está no banco. Quem lê valida e cai no texto original se precisar. */
export interface LegalDocumentRepository {
  listCurrent(): Promise<unknown[]>;
}

// ---------------------------------------------------------------------------
// Painel administrativo
// ---------------------------------------------------------------------------

export interface AdminSession {
  email: string;
  name: string | null;
  role: AdminRole;
  /** Áreas liberadas, só no ajudante. */
  permissions: StaffPermission[];
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

export type AuthState =
  | { status: "signed-out" }
  /** Senha conferida; falta o código do app autenticador (verificação em duas etapas). */
  | { status: "mfa-required" }
  | { status: "signed-in"; session: AdminSession };

export interface MfaEnrollment {
  factorId: string;
  /** QR code (data URL) para ler no app autenticador. Nulo no modo demonstração. */
  qrCode: string | null;
  /** A mesma chave do QR, para digitar à mão. */
  secret: string;
}

export interface AuthService {
  getState(): Promise<AuthState>;
  /** Devolve "mfa-required" quando a pessoa ligou a verificação em duas etapas. */
  signIn(email: string, password: string): Promise<AuthState>;
  /** Confere o código do app autenticador depois da senha. Falha com `InvalidMfaCodeError`. */
  verifyMfa(code: string): Promise<AdminSession>;
  signOut(): Promise<void>;
  /** Fator do app autenticador já confirmado, ou nulo com a verificação em duas etapas desligada. */
  getMfaFactorId(): Promise<string | null>;
  startMfaEnrollment(): Promise<MfaEnrollment>;
  /** Confirma o cadastro com o primeiro código do app. Falha com `InvalidMfaCodeError`. */
  confirmMfaEnrollment(factorId: string, code: string): Promise<void>;
  disableMfa(factorId: string): Promise<void>;
  /** Confere a senha atual. Falha com `WrongCurrentPasswordError`. */
  verifyPassword(email: string, password: string): Promise<void>;
  changePassword(newPassword: string): Promise<void>;
  requestPasswordReset(email: string, redirectTo: string): Promise<void>;
  updateProfile(update: ProfileUpdate, emailRedirectTo: string): Promise<ProfileUpdateResult>;
  onChange(listener: (state: AuthState) => void): () => void;
}

export interface AdminSiteContentRepository extends SiteContentRepository {
  save(content: SiteContent): Promise<void>;
}

export interface AdminLegalDocumentRepository extends LegalDocumentRepository {
  /** Publica versão nova de quem mudou. O banco numera, data e guarda o histórico. */
  publish(input: LegalPublishInput): Promise<void>;
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
  /** O Jota viu o Pix cair na conta. Com todas as partes pagas, o pedido vira "pago". */
  confirmPixPayment(paymentId: string): Promise<void>;
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

export interface AdminEmailAccountRepository {
  /** Sem a senha: ela só é aberta pelo findById. */
  listAll(): Promise<EmailAccountListItem[]>;
  findById(id: string): Promise<EmailAccount | null>;
  /** E-mail ligado a uma conta do estoque, com a senha. O mais recente, se houver mais de um. */
  findByAccountId(accountId: string): Promise<EmailAccount | null>;
  /** Para ligar a uma conta um e-mail que já estava salvo sem ligação. */
  findByEmail(email: string): Promise<EmailAccount | null>;
  create(data: EmailAccountData): Promise<EmailAccount>;
  update(id: string, data: EmailAccountData): Promise<EmailAccount>;
  remove(id: string): Promise<void>;
}

/** Solicitações LGPD, anonimização de titular e prazos de retenção. */
export interface AdminPrivacyRepository {
  listRequests(): Promise<DataRequest[]>;
  answer(id: string, answer: DataRequestAnswer): Promise<void>;
  anonymizeSubject(contact: string): Promise<AnonymizationResult>;
  applyRetention(): Promise<RetentionResult>;
}

/** Quem entra no sistema. Criar e remover passam pelo servidor, que confere se quem pede é administrador. */
export interface AdminUserRepository {
  listAll(): Promise<AdminUser[]>;
  create(input: NewAdminUser): Promise<AdminUser>;
  /** Troca entre admin e ajudante e as áreas liberadas. O banco recusa mudar o próprio acesso e ficar sem admin. */
  setAccess(id: string, access: AdminUserAccess): Promise<void>;
  remove(id: string): Promise<void>;
}

/**
 * Chamados de suporte. Quem abre e quem responde é sempre o usuário logado (o banco grava sozinho);
 * a situação só muda pela desenvolvedora, e o banco confere isso também.
 */
export interface SupportTicketRepository {
  /** Sem endereço dos anexos: a lista só precisa saber quantos são. */
  listAll(): Promise<SupportTicket[]>;
  /** Com endereço temporário de cada anexo, para ver na conversa. */
  findById(id: string): Promise<SupportTicket | null>;
  /** Salva o texto e depois sobe os anexos; arquivo que falhar volta em `failedUploads`. */
  open(data: SupportTicketData, uploads: readonly SupportUpload[]): Promise<SupportSubmitResult<SupportTicket>>;
  reply(ticketId: string, body: string, uploads: readonly SupportUpload[], replyToId: string | null): Promise<SupportSubmitResult<SupportReply>>;
  changeStatus(ticketId: string, status: SupportStatus): Promise<void>;
  /** Jota ou a desenvolvedora, em chamado ainda não finalizado. */
  changePriority(ticketId: string, priority: SupportPriority): Promise<void>;
  /** Marca que quem está logado abriu o chamado agora. `notify`: a Lay vendo novidade do Jota avisa no sininho dele. */
  markSeen(ticketId: string, notify: boolean): Promise<void>;
  /** A Lay avisa o Jota no sininho que abriu ou respondeu o chamado (o banco monta o texto). */
  notifyAdmin(ticketId: string, event: SupportNotifyEvent): Promise<void>;
  /** Interno: só a desenvolvedora vê. Só ela muda (o banco confere). */
  setInternal(ticketId: string, internal: boolean): Promise<void>;
  /** O Jota aprova e finaliza um chamado que está aguardando ele (o banco confere papel e situação). */
  approve(ticketId: string): Promise<void>;
  /** Etiquetas em ordem de criação. Criar, mudar, apagar e escolher: só a desenvolvedora (o banco confere). */
  listLabels(): Promise<SupportLabel[]>;
  createLabel(data: SupportLabelData): Promise<SupportLabel>;
  updateLabel(id: string, data: SupportLabelData): Promise<SupportLabel>;
  /** Os chamados com essa etiqueta ficam sem etiqueta. */
  removeLabel(id: string): Promise<void>;
  setLabel(ticketId: string, labelId: string | null): Promise<void>;
  /** Apaga o chamado com conversa, anexos e histórico. Só a desenvolvedora (o banco confere). */
  remove(ticketId: string): Promise<void>;
}

/**
 * Acessos (TI): o que a desenvolvedora faz pelos usuários. O servidor confere o papel em cada chamada.
 * Trocar e-mail e senha passam pela Edge Function admin-users (chave de serviço); sessões e duas etapas, por funções do banco.
 */
export interface AccessRepository {
  listAll(): Promise<AccessUser[]>;
  updateProfile(userId: string, update: AccessProfileUpdate): Promise<void>;
  setPassword(userId: string, password: string): Promise<void>;
  /** Desconecta a pessoa de todos os aparelhos. */
  endSessions(userId: string): Promise<void>;
  /** Desliga a verificação em duas etapas (ex.: perdeu o celular); ela cadastra de novo em Configurações. */
  resetMfa(userId: string): Promise<void>;
}

/** Lê os números públicos de um perfil pelo link. Falha com `ProfileLookupError`. */
export interface ProfileLookupService {
  lookup(url: string): Promise<ProfileLookup>;
}

/** Notificações do sininho guardadas no banco, e o que cada usuário já apagou. */
export interface AdminNotificationRepository {
  listRecent(): Promise<StoredNotification[]>;
  /** O sininho do Jota, para a desenvolvedora no "Ver como o Jota": o banco só libera para ela. */
  listRecentForAdmin(): Promise<StoredNotification[]>;
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

export type MediaFolder = "accounts" | "testimonials" | "site";

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
