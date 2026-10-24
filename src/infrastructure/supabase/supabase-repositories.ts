import { FunctionsHttpError, type PostgrestError, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { matchesFilter, sortAccounts } from "@/application/catalog";
import { PASSWORD_RULE_HINT } from "@/application/schemas";
import type {
  AccountFilter,
  AccountRepository,
  AdminAccountRepository,
  AdminCustomerRepository,
  AdminExpenseRepository,
  AdminLeadRepository,
  AdminMessageTemplateRepository,
  AdminNotificationRepository,
  AdminOrderRepository,
  AdminEmailAccountRepository,
  AdminPartnerRepository,
  AdminPreferenceKey,
  AdminPreferenceRepository,
  AdminSiteContentRepository,
  AdminRevenueRepository,
  AdminStoreSettingsRepository,
  AdminTestimonialRepository,
  AdminUserRepository,
  NewOrder,
  OrderRepository,
  TestimonialRepository,
} from "@/application/ports";
import type { Account, AccountData } from "@/domain/account";
import type { LegalConsent, LegalDocumentSlug } from "@/domain/legal/legal-document";
import type { AdminUser, NewAdminUser } from "@/domain/admin-user";
import {
  AccountNotFoundError,
  AccountUnavailableError,
  AdminUserEmailTakenError,
  CannotRemoveAdminUserError,
  CustomerEmailTakenError,
  CustomerNotFoundError,
  ExpenseNotFoundError,
  RevenueNotFoundError,
  InvalidTransitionError,
  LeadNotFoundError,
  PartnerNotFoundError,
  EmailAccountNotFoundError,
  EmailAccountTakenError,
  SlugTakenError,
  TooManyAttemptsError,
  TooManyOpenOrdersError,
  OutdatedLegalDocumentsError,
  TooManyOpenDataRequestsError,
  TooManyPrivacyAttemptsError,
} from "@/domain/errors";
import { RESERVATION_HOLD_MINUTES, type Order, type OrderStatus } from "@/domain/order";
import { BRAZIL_STATES, type CustomerRecord, type CustomerRecordData } from "@/domain/customer";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_METHODS,
  REVENUE_CATEGORIES,
  type Expense,
  type ExpenseData,
  type Revenue,
  type RevenueData,
} from "@/domain/finance";
import { LEAD_SOURCES, LEAD_STAGES, type Lead, type LeadData, type LeadStage } from "@/domain/lead";
import {
  DEFAULT_MESSAGE_TEMPLATES,
  MESSAGE_TEMPLATE_KEYS,
  type MessageTemplateKey,
  type MessageTemplates,
} from "@/domain/message-template";
import type { StoredNotification } from "@/domain/notification";
import type { EmailAccount, EmailAccountData, EmailAccountListItem } from "@/domain/email-account";
import type { Partner, PartnerData } from "@/domain/partner";
import { PLATFORMS } from "@/domain/platform";
import type { SiteContent } from "@/domain/site-content";
import type { StoreSettings } from "@/domain/store-settings";
import type { Testimonial, TestimonialData } from "@/domain/testimonial";
import {
  ACCOUNT_COLUMNS,
  ORDER_COLUMNS,
  TESTIMONIAL_COLUMNS,
  toAccount,
  toAccountRow,
  toOrder,
  toTestimonial,
  toTestimonialRow,
} from "./rows";

const UNIQUE_VIOLATION = "23505";

/** Erro do PostgREST com a mensagem original no log e uma mensagem legível para a tela. */
export class BackendError extends Error {
  constructor(
    readonly cause: PostgrestError,
    message = "Não foi possível falar com o servidor. Tente de novo em instantes.",
  ) {
    super(message);
    this.name = "BackendError";
  }
}

/**
 * Só código, mensagem e dica vão para o console. `details` fica de fora: numa violação de constraint o Postgres
 * repete ali a linha inteira, com os dados pessoais digitados.
 */
export function logBackendError(error: PostgrestError): void {
  console.error("Erro do banco", { code: error.code, message: error.message, hint: error.hint });
}

export function fail(error: PostgrestError): never {
  logBackendError(error);
  throw new BackendError(error);
}

/** Checkout e página do pedido: o limite de tentativas tem mensagem própria (a do Meus dados fala de privacidade). */
function failFromOrderRpc(error: PostgrestError): never {
  if (error.message.includes("too_many_attempts")) throw new TooManyAttemptsError();
  return failFromRpc(error);
}

/** Erros de regra que as funções do banco levantam com `raise exception '<código>'`. */
export function failFromRpc(error: PostgrestError): never {
  if (error.message.includes("outdated_legal_documents")) throw new OutdatedLegalDocumentsError();
  if (error.message.includes("too_many_attempts")) throw new TooManyPrivacyAttemptsError();
  if (error.message.includes("too_many_open_requests")) throw new TooManyOpenDataRequestsError();
  if (error.message.includes("account_unavailable")) throw new AccountUnavailableError();
  if (error.message.includes("account_not_found")) throw new AccountNotFoundError("");
  if (error.message.includes("too_many_open_orders")) throw new TooManyOpenOrdersError();
  if (error.message.includes("invalid_transition")) throw new InvalidTransitionError();
  if (error.message.includes("invalid_split")) {
    throw new BackendError(error, "A divisão do pagamento não fecha com o valor da conta. Confira os valores.");
  }
  return fail(error);
}

/** Caracteres que quebram a sintaxe de filtro do PostgREST (`or=(...)`). */
function sanitizeQuery(query: string): string {
  return query.replace(/[,()*%\\]/g, " ").trim();
}

export class SupabaseAccountRepository implements AccountRepository, AdminAccountRepository {
  /** A vitrine (chave anon) usa PUBLIC_ACCOUNT_COLUMNS; o painel, todas as colunas. */
  constructor(
    private readonly client: SupabaseClient,
    private readonly columns: string = ACCOUNT_COLUMNS,
  ) {}

  /**
   * Rede, faixa de seguidores e busca vão para o banco. Disponibilidade e ordenação são resolvidas aqui,
   * porque reserva vencida conta como disponível (ver `effectiveStatus`).
   */
  async list(filter: AccountFilter): Promise<Account[]> {
    let request = this.client.from("accounts").select(this.columns);
    if (filter.platform) request = request.eq("platform", filter.platform);
    if (filter.minFollowers !== undefined) request = request.gte("followers", filter.minFollowers);
    if (filter.maxFollowers !== undefined) request = request.lt("followers", filter.maxFollowers);
    if (filter.onlyAvailable) request = request.neq("status", "sold");
    const query = filter.query ? sanitizeQuery(filter.query) : "";
    if (query) request = request.or(`display_name.ilike.%${query}%,handle.ilike.%${query}%,niche.ilike.%${query}%`);

    const { data, error } = await request.order("listed_at", { ascending: false });
    if (error) fail(error);
    const accounts = data.map(toAccount).filter((account) => matchesFilter(account, { ...filter, query: undefined }));
    return sortAccounts(accounts, filter.sort);
  }

  async findBySlug(slug: string): Promise<Account | null> {
    const { data, error } = await this.client.from("accounts").select(this.columns).eq("slug", slug).maybeSingle();
    if (error) fail(error);
    return data ? toAccount(data) : null;
  }

  async findById(id: string): Promise<Account | null> {
    const { data, error } = await this.client.from("accounts").select(this.columns).eq("id", id).maybeSingle();
    if (error) fail(error);
    return data ? toAccount(data) : null;
  }

  async listAll(): Promise<Account[]> {
    const { data, error } = await this.client
      .from("accounts")
      .select(this.columns)
      .order("listed_at", { ascending: false });
    if (error) fail(error);
    return sortAccounts(data.map(toAccount), "recent");
  }

  async create(input: AccountData): Promise<Account> {
    const { data, error } = await this.client.from("accounts").insert(toAccountRow(input)).select(this.columns).single();
    if (error) this.failOnWrite(error, input.slug);
    return toAccount(data);
  }

  async update(id: string, input: AccountData): Promise<Account> {
    const { data, error } = await this.client
      .from("accounts")
      .update(toAccountRow(input))
      .eq("id", id)
      .select(this.columns)
      .single();
    if (error) this.failOnWrite(error, input.slug);
    return toAccount(data);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.client.from("accounts").delete().eq("id", id);
    if (error) fail(error);
  }

  private failOnWrite(error: PostgrestError, slug: string): never {
    if (error.code === UNIQUE_VIOLATION) throw new SlugTakenError(slug);
    return fail(error);
  }
}

export class SupabaseTestimonialRepository implements TestimonialRepository, AdminTestimonialRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listPublished(): Promise<Testimonial[]> {
    const { data, error } = await this.client
      .from("testimonials")
      .select(TESTIMONIAL_COLUMNS)
      .eq("published", true)
      .order("position");
    if (error) fail(error);
    return data.map(toTestimonial);
  }

  async listAll(): Promise<Testimonial[]> {
    const { data, error } = await this.client.from("testimonials").select(TESTIMONIAL_COLUMNS).order("position");
    if (error) fail(error);
    return data.map(toTestimonial);
  }

  async findById(id: string): Promise<Testimonial | null> {
    const { data, error } = await this.client.from("testimonials").select(TESTIMONIAL_COLUMNS).eq("id", id).maybeSingle();
    if (error) fail(error);
    return data ? toTestimonial(data) : null;
  }

  async create(input: TestimonialData): Promise<Testimonial> {
    const last = await this.client
      .from("testimonials")
      .select("position")
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last.error) fail(last.error);
    const position = typeof last.data?.position === "number" ? last.data.position + 1 : 0;

    const { data, error } = await this.client
      .from("testimonials")
      .insert({ ...toTestimonialRow(input), position })
      .select(TESTIMONIAL_COLUMNS)
      .single();
    if (error) fail(error);
    return toTestimonial(data);
  }

  async update(id: string, input: TestimonialData): Promise<Testimonial> {
    const { data, error } = await this.client
      .from("testimonials")
      .update(toTestimonialRow(input))
      .eq("id", id)
      .select(TESTIMONIAL_COLUMNS)
      .single();
    if (error) fail(error);
    return toTestimonial(data);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.client.from("testimonials").delete().eq("id", id);
    if (error) fail(error);
  }

  async reorder(ids: string[]): Promise<void> {
    const results = await Promise.all(
      ids.map((id, position) => this.client.from("testimonials").update({ position }).eq("id", id)),
    );
    const failed = results.find((result) => result.error);
    if (failed?.error) fail(failed.error);
  }
}

function consentOf(input: NewOrder, slug: LegalDocumentSlug): LegalConsent {
  const consent = input.consents.find((item) => item.slug === slug);
  if (!consent) throw new OutdatedLegalDocumentsError();
  return consent;
}

export class SupabaseOrderRepository implements OrderRepository, AdminOrderRepository {
  constructor(private readonly client: SupabaseClient) {}

  async place(input: NewOrder): Promise<Order> {
    const { data, error } = await this.client.rpc("place_order", {
      p_account_id: input.accountId,
      p_name: input.customer.name,
      p_email: input.customer.email,
      p_whatsapp: input.customer.whatsapp ?? "",
      p_document: input.customer.document,
      p_birth_date: input.customer.birthDate,
      p_instagram: input.customer.instagram,
      p_city: input.customer.city,
      p_state: input.customer.state,
      p_payment_method: input.paymentMethod,
      p_terms_version: consentOf(input, "terms").version,
      p_terms_sha256: consentOf(input, "terms").sha256,
      p_privacy_version: consentOf(input, "privacy").version,
      p_privacy_sha256: consentOf(input, "privacy").sha256,
      p_source: input.customer.source,
      p_referred_by: input.customer.referredBy,
      p_first_part_cents: input.firstPartCents,
      p_hold_minutes: RESERVATION_HOLD_MINUTES,
    });
    if (error) failFromOrderRpc(error);
    return toOrder(data);
  }

  async findByCode(code: string): Promise<Order | null> {
    const { data, error } = await this.client.rpc("get_order", { p_code: code });
    if (error) failFromOrderRpc(error);
    return data ? toOrder(data) : null;
  }

  async listAll(): Promise<Order[]> {
    const { data, error } = await this.client
      .from("orders")
      .select(ORDER_COLUMNS)
      .order("created_at", { ascending: false });
    if (error) fail(error);
    return data.map(toOrder);
  }

  async updateStatus(code: string, status: OrderStatus): Promise<void> {
    const { error } = await this.client.from("orders").update({ status }).eq("code", code);
    if (error) failFromRpc(error);
  }

  async confirmPixPayment(paymentId: string): Promise<void> {
    const { error } = await this.client
      .from("order_payments")
      .update({ status: "paid" })
      .eq("id", paymentId)
      .eq("method", "pix")
      .eq("status", "pending");
    if (error) failFromRpc(error);
  }
}

const SETTINGS_COLUMNS = "whatsapp_number, instagram_handle, guarantee_days, pix_key, pix_receiver_name, pix_receiver_city";

interface StoreSettingsRow {
  whatsapp_number: string | null;
  instagram_handle: string;
  guarantee_days: number;
  pix_key: string | null;
  pix_receiver_name: string | null;
  pix_receiver_city: string | null;
}

const toStoreSettings = (row: StoreSettingsRow): StoreSettings => ({
  whatsappNumber: row.whatsapp_number,
  instagramHandle: row.instagram_handle,
  guaranteeDays: row.guarantee_days,
  pixKey: row.pix_key,
  pixReceiverName: row.pix_receiver_name,
  pixReceiverCity: row.pix_receiver_city,
});

/** Textos do site: linha única (`id = true`), criada no primeiro salvamento. */
export class SupabaseSiteContentRepository implements AdminSiteContentRepository {
  constructor(private readonly client: SupabaseClient) {}

  async load(): Promise<unknown> {
    const { data, error } = await this.client.from("site_content").select("content").eq("id", true).maybeSingle<{ content: unknown }>();
    if (error) fail(error);
    return data?.content ?? null;
  }

  async save(content: SiteContent): Promise<void> {
    const { error } = await this.client.from("site_content").upsert({ id: true, content }, { onConflict: "id" });
    if (error) fail(error);
  }
}

/** Linha única (`id = true`) criada pela migration; o painel só atualiza. */
export class SupabaseStoreSettingsRepository implements AdminStoreSettingsRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly defaults: StoreSettings,
  ) {}

  async get(): Promise<StoreSettings> {
    const { data, error } = await this.client
      .from("store_settings")
      .select(SETTINGS_COLUMNS)
      .maybeSingle<StoreSettingsRow>();
    if (error) fail(error);
    return data ? toStoreSettings(data) : this.defaults;
  }

  async save(settings: StoreSettings): Promise<StoreSettings> {
    const { data, error } = await this.client
      .from("store_settings")
      .update({
        whatsapp_number: settings.whatsappNumber,
        instagram_handle: settings.instagramHandle,
        guarantee_days: settings.guaranteeDays,
        pix_key: settings.pixKey,
        pix_receiver_name: settings.pixReceiverName,
        pix_receiver_city: settings.pixReceiverCity,
      })
      .eq("id", true)
      .select(SETTINGS_COLUMNS)
      .single<StoreSettingsRow>();
    if (error) fail(error);
    return toStoreSettings(data);
  }
}

const LEAD_COLUMNS =
  "id, name, whatsapp, instagram, source, interest, stage, budget_cents, next_follow_up, notes, created_at, updated_at";

const leadRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  whatsapp: z.string().nullable(),
  instagram: z.string().nullable(),
  source: z.enum(LEAD_SOURCES),
  interest: z.enum(PLATFORMS).nullable(),
  stage: z.enum(LEAD_STAGES),
  budget_cents: z.number().nullable(),
  next_follow_up: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

function toLead(raw: unknown): Lead {
  const row = leadRowSchema.parse(raw);
  return {
    id: row.id,
    name: row.name,
    whatsapp: row.whatsapp,
    instagram: row.instagram,
    source: row.source,
    interest: row.interest,
    stage: row.stage,
    budget: row.budget_cents,
    nextFollowUp: row.next_follow_up,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const toLeadRow = (data: LeadData) => ({
  name: data.name,
  whatsapp: data.whatsapp,
  instagram: data.instagram,
  source: data.source,
  interest: data.interest,
  stage: data.stage,
  budget_cents: data.budget,
  next_follow_up: data.nextFollowUp,
  notes: data.notes,
});

export class SupabaseLeadRepository implements AdminLeadRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listAll(): Promise<Lead[]> {
    const { data, error } = await this.client
      .from("leads")
      .select(LEAD_COLUMNS)
      .order("next_follow_up", { ascending: true, nullsFirst: false })
      .order("updated_at", { ascending: false });
    if (error) fail(error);
    return data.map(toLead);
  }

  async findById(id: string): Promise<Lead | null> {
    const { data, error } = await this.client.from("leads").select(LEAD_COLUMNS).eq("id", id).maybeSingle();
    if (error) fail(error);
    return data ? toLead(data) : null;
  }

  async create(input: LeadData): Promise<Lead> {
    const { data, error } = await this.client.from("leads").insert(toLeadRow(input)).select(LEAD_COLUMNS).single();
    if (error) fail(error);
    return toLead(data);
  }

  async update(id: string, input: LeadData): Promise<Lead> {
    const { data, error } = await this.client
      .from("leads")
      .update(toLeadRow(input))
      .eq("id", id)
      .select(LEAD_COLUMNS)
      .maybeSingle();
    if (error) fail(error);
    if (!data) throw new LeadNotFoundError();
    return toLead(data);
  }

  async moveToStage(id: string, stage: LeadStage): Promise<void> {
    const { data, error } = await this.client.from("leads").update({ stage }).eq("id", id).select("id");
    if (error) fail(error);
    if (data.length === 0) throw new LeadNotFoundError();
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.client.from("leads").delete().eq("id", id);
    if (error) fail(error);
  }
}

// O documento entra pela coluna `document` (o banco cifra) e volta aberto por document_plain, só para administrador.
const CUSTOMER_COLUMNS =
  "id, name, document:document_plain, birth_date, email, whatsapp, instagram, city, state, source, referred_by, interest, notes, created_at";

const customerRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  document: z.string().nullable(),
  birth_date: z.string().nullable(),
  email: z.string().nullable(),
  whatsapp: z.string().nullable(),
  instagram: z.string().nullable(),
  city: z.string().nullable(),
  state: z.enum(BRAZIL_STATES).nullable(),
  source: z.enum(LEAD_SOURCES).nullable(),
  referred_by: z.string().nullable(),
  interest: z.enum(PLATFORMS).nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
});

function toCustomerRecord(raw: unknown): CustomerRecord {
  const row = customerRowSchema.parse(raw);
  return {
    id: row.id,
    name: row.name,
    document: row.document,
    birthDate: row.birth_date,
    email: row.email,
    whatsapp: row.whatsapp,
    instagram: row.instagram,
    city: row.city,
    state: row.state,
    source: row.source,
    referredBy: row.referred_by,
    interest: row.interest,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

const toCustomerRow = ({ birthDate, referredBy, ...data }: CustomerRecordData) => ({
  ...data,
  birth_date: birthDate,
  referred_by: referredBy,
});

function failOnCustomerWrite(error: PostgrestError, email: string | null): never {
  if (error.code === UNIQUE_VIOLATION && email) throw new CustomerEmailTakenError(email);
  return fail(error);
}

export class SupabaseCustomerRepository implements AdminCustomerRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listAll(): Promise<CustomerRecord[]> {
    const { data, error } = await this.client.from("customers").select(CUSTOMER_COLUMNS).order("created_at", { ascending: false });
    if (error) fail(error);
    return data.map(toCustomerRecord);
  }

  async findById(id: string): Promise<CustomerRecord | null> {
    const { data, error } = await this.client.from("customers").select(CUSTOMER_COLUMNS).eq("id", id).maybeSingle();
    if (error) fail(error);
    return data ? toCustomerRecord(data) : null;
  }

  async create(input: CustomerRecordData): Promise<CustomerRecord> {
    const { data, error } = await this.client.from("customers").insert(toCustomerRow(input)).select(CUSTOMER_COLUMNS).single();
    if (error) failOnCustomerWrite(error, input.email);
    return toCustomerRecord(data);
  }

  async update(id: string, input: CustomerRecordData): Promise<CustomerRecord> {
    const { data, error } = await this.client
      .from("customers")
      .update(toCustomerRow(input))
      .eq("id", id)
      .select(CUSTOMER_COLUMNS)
      .maybeSingle();
    if (error) failOnCustomerWrite(error, input.email);
    if (!data) throw new CustomerNotFoundError();
    return toCustomerRecord(data);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.client.from("customers").delete().eq("id", id);
    if (error) fail(error);
  }
}

const templateRowSchema = z.object({ key: z.enum(MESSAGE_TEMPLATE_KEYS), body: z.string() });

export class SupabaseMessageTemplateRepository implements AdminMessageTemplateRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getAll(): Promise<MessageTemplates> {
    const { data, error } = await this.client.from("message_templates").select("key, body");
    if (error) fail(error);
    const saved = data.map((row) => templateRowSchema.parse(row));
    return saved.reduce<MessageTemplates>((all, row) => ({ ...all, [row.key]: row.body }), { ...DEFAULT_MESSAGE_TEMPLATES });
  }

  async save(templates: MessageTemplates): Promise<MessageTemplates> {
    const rows = (Object.keys(templates) as MessageTemplateKey[]).map((key) => ({ key, body: templates[key] }));
    const { error } = await this.client.from("message_templates").upsert(rows, { onConflict: "key" });
    if (error) fail(error);
    return templates;
  }
}

export class SupabasePreferenceRepository implements AdminPreferenceRepository {
  constructor(private readonly client: SupabaseClient) {}

  async get(key: AdminPreferenceKey): Promise<unknown> {
    const { data, error } = await this.client.from("admin_preferences").select("value").eq("key", key).maybeSingle<{ value: unknown }>();
    if (error) fail(error);
    return data?.value ?? null;
  }

  async set(key: AdminPreferenceKey, value: unknown): Promise<void> {
    const { error } = await this.client.from("admin_preferences").upsert({ key, value }, { onConflict: "key" });
    if (error) fail(error);
  }
}

const EXPENSE_COLUMNS = "id, description, category, amount_cents, spent_on, supplier, payment_method, account_id, notes, created_at";

const expenseRowSchema = z.object({
  id: z.string(),
  description: z.string(),
  category: z.enum(EXPENSE_CATEGORIES),
  amount_cents: z.number(),
  spent_on: z.string(),
  supplier: z.string().nullable(),
  payment_method: z.enum(EXPENSE_PAYMENT_METHODS).nullable(),
  account_id: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
});

function toExpense(raw: unknown): Expense {
  const row = expenseRowSchema.parse(raw);
  return {
    id: row.id,
    description: row.description,
    category: row.category,
    amount: row.amount_cents,
    date: row.spent_on,
    supplier: row.supplier,
    paymentMethod: row.payment_method,
    accountId: row.account_id,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

const toExpenseRow = (data: ExpenseData) => ({
  description: data.description,
  category: data.category,
  amount_cents: data.amount,
  spent_on: data.date,
  supplier: data.supplier,
  payment_method: data.paymentMethod,
  account_id: data.accountId,
  notes: data.notes,
});

export class SupabaseExpenseRepository implements AdminExpenseRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listAll(): Promise<Expense[]> {
    const { data, error } = await this.client
      .from("expenses")
      .select(EXPENSE_COLUMNS)
      .order("spent_on", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) fail(error);
    return data.map(toExpense);
  }

  async findById(id: string): Promise<Expense | null> {
    const { data, error } = await this.client.from("expenses").select(EXPENSE_COLUMNS).eq("id", id).maybeSingle();
    if (error) fail(error);
    return data ? toExpense(data) : null;
  }

  async create(input: ExpenseData): Promise<Expense> {
    const { data, error } = await this.client.from("expenses").insert(toExpenseRow(input)).select(EXPENSE_COLUMNS).single();
    if (error) fail(error);
    return toExpense(data);
  }

  async update(id: string, input: ExpenseData): Promise<Expense> {
    const { data, error } = await this.client
      .from("expenses")
      .update(toExpenseRow(input))
      .eq("id", id)
      .select(EXPENSE_COLUMNS)
      .maybeSingle();
    if (error) fail(error);
    if (!data) throw new ExpenseNotFoundError();
    return toExpense(data);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.client.from("expenses").delete().eq("id", id);
    if (error) fail(error);
  }
}

const REVENUE_COLUMNS = "id, description, category, amount_cents, received_on, payment_method, customer_id, account_id, notes, created_at";

const revenueRowSchema = z.object({
  id: z.string(),
  description: z.string(),
  category: z.enum(REVENUE_CATEGORIES),
  amount_cents: z.number(),
  received_on: z.string(),
  payment_method: z.enum(EXPENSE_PAYMENT_METHODS).nullable(),
  customer_id: z.string().nullable(),
  account_id: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
});

function toRevenue(raw: unknown): Revenue {
  const row = revenueRowSchema.parse(raw);
  return {
    id: row.id,
    description: row.description,
    category: row.category,
    amount: row.amount_cents,
    date: row.received_on,
    paymentMethod: row.payment_method,
    customerId: row.customer_id,
    accountId: row.account_id,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

const toRevenueRow = (data: RevenueData) => ({
  description: data.description,
  category: data.category,
  amount_cents: data.amount,
  received_on: data.date,
  payment_method: data.paymentMethod,
  customer_id: data.customerId,
  account_id: data.accountId,
  notes: data.notes,
});

export class SupabaseRevenueRepository implements AdminRevenueRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listAll(): Promise<Revenue[]> {
    const { data, error } = await this.client
      .from("revenues")
      .select(REVENUE_COLUMNS)
      .order("received_on", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) fail(error);
    return data.map(toRevenue);
  }

  async findById(id: string): Promise<Revenue | null> {
    const { data, error } = await this.client.from("revenues").select(REVENUE_COLUMNS).eq("id", id).maybeSingle();
    if (error) fail(error);
    return data ? toRevenue(data) : null;
  }

  async create(input: RevenueData): Promise<Revenue> {
    const { data, error } = await this.client.from("revenues").insert(toRevenueRow(input)).select(REVENUE_COLUMNS).single();
    if (error) fail(error);
    return toRevenue(data);
  }

  async update(id: string, input: RevenueData): Promise<Revenue> {
    const { data, error } = await this.client
      .from("revenues")
      .update(toRevenueRow(input))
      .eq("id", id)
      .select(REVENUE_COLUMNS)
      .maybeSingle();
    if (error) fail(error);
    if (!data) throw new RevenueNotFoundError();
    return toRevenue(data);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.client.from("revenues").delete().eq("id", id);
    if (error) fail(error);
  }
}

const PARTNER_COLUMNS = "id, name, whatsapp, instagram, pix_key, commission_percent, notes, active, created_at";

const partnerRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  whatsapp: z.string().nullable(),
  instagram: z.string().nullable(),
  pix_key: z.string().nullable(),
  // numeric pode chegar como texto, conforme a versão do PostgREST.
  commission_percent: z.coerce.number(),
  notes: z.string().nullable(),
  active: z.boolean(),
  created_at: z.string(),
});

function toPartner(raw: unknown): Partner {
  const row = partnerRowSchema.parse(raw);
  return {
    id: row.id,
    name: row.name,
    whatsapp: row.whatsapp,
    instagram: row.instagram,
    pixKey: row.pix_key,
    commissionPercent: row.commission_percent,
    notes: row.notes,
    active: row.active,
    createdAt: row.created_at,
  };
}

const toPartnerRow = (data: PartnerData) => ({
  name: data.name,
  whatsapp: data.whatsapp,
  instagram: data.instagram,
  pix_key: data.pixKey,
  commission_percent: data.commissionPercent,
  notes: data.notes,
  active: data.active,
});

export class SupabasePartnerRepository implements AdminPartnerRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listAll(): Promise<Partner[]> {
    const { data, error } = await this.client.from("partners").select(PARTNER_COLUMNS).order("name");
    if (error) fail(error);
    return data.map(toPartner);
  }

  async findById(id: string): Promise<Partner | null> {
    const { data, error } = await this.client.from("partners").select(PARTNER_COLUMNS).eq("id", id).maybeSingle();
    if (error) fail(error);
    return data ? toPartner(data) : null;
  }

  async create(input: PartnerData): Promise<Partner> {
    const { data, error } = await this.client.from("partners").insert(toPartnerRow(input)).select(PARTNER_COLUMNS).single();
    if (error) fail(error);
    return toPartner(data);
  }

  async update(id: string, input: PartnerData): Promise<Partner> {
    const { data, error } = await this.client
      .from("partners")
      .update(toPartnerRow(input))
      .eq("id", id)
      .select(PARTNER_COLUMNS)
      .maybeSingle();
    if (error) fail(error);
    if (!data) throw new PartnerNotFoundError();
    return toPartner(data);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.client.from("partners").delete().eq("id", id);
    if (error) fail(error);
  }
}

// A senha entra pela coluna `password` (o banco cifra) e volta aberta por password_plain, só para administrador.
const EMAIL_ACCOUNT_LIST_COLUMNS = "id, email, used_for, recovery_email, recovery_phone, account_id, notes, created_at, updated_at, has_password";
const EMAIL_ACCOUNT_COLUMNS = `${EMAIL_ACCOUNT_LIST_COLUMNS}, password:password_plain`;

const emailAccountRowSchema = z.object({
  id: z.string(),
  email: z.string(),
  used_for: z.string().nullable(),
  recovery_email: z.string().nullable(),
  recovery_phone: z.string().nullable(),
  account_id: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  has_password: z.boolean(),
});

function toEmailAccountListItem(raw: unknown): EmailAccountListItem {
  const row = emailAccountRowSchema.parse(raw);
  return {
    id: row.id,
    email: row.email,
    usedFor: row.used_for,
    recoveryEmail: row.recovery_email,
    recoveryPhone: row.recovery_phone,
    accountId: row.account_id,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    hasPassword: row.has_password,
  };
}

function toEmailAccount(raw: unknown): EmailAccount {
  const { password } = z.object({ password: z.string().nullable() }).parse(raw);
  const { hasPassword: _hasPassword, ...item } = toEmailAccountListItem(raw);
  return { ...item, password };
}

const toEmailAccountRow = (data: EmailAccountData) => ({
  email: data.email,
  password: data.password,
  used_for: data.usedFor,
  recovery_email: data.recoveryEmail,
  recovery_phone: data.recoveryPhone,
  account_id: data.accountId,
  notes: data.notes,
});

function failOnEmailAccountWrite(error: PostgrestError, email: string): never {
  if (error.code === UNIQUE_VIOLATION) throw new EmailAccountTakenError(email);
  return fail(error);
}

export class SupabaseEmailAccountRepository implements AdminEmailAccountRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listAll(): Promise<EmailAccountListItem[]> {
    const { data, error } = await this.client.from("email_accounts").select(EMAIL_ACCOUNT_LIST_COLUMNS).order("email");
    if (error) fail(error);
    return data.map(toEmailAccountListItem);
  }

  async findById(id: string): Promise<EmailAccount | null> {
    const { data, error } = await this.client.from("email_accounts").select(EMAIL_ACCOUNT_COLUMNS).eq("id", id).maybeSingle();
    if (error) fail(error);
    return data ? toEmailAccount(data) : null;
  }

  async create(input: EmailAccountData): Promise<EmailAccount> {
    const { data, error } = await this.client.from("email_accounts").insert(toEmailAccountRow(input)).select(EMAIL_ACCOUNT_COLUMNS).single();
    if (error) failOnEmailAccountWrite(error, input.email);
    return toEmailAccount(data);
  }

  async update(id: string, input: EmailAccountData): Promise<EmailAccount> {
    const { data, error } = await this.client
      .from("email_accounts")
      .update(toEmailAccountRow(input))
      .eq("id", id)
      .select(EMAIL_ACCOUNT_COLUMNS)
      .maybeSingle();
    if (error) failOnEmailAccountWrite(error, input.email);
    if (!data) throw new EmailAccountNotFoundError();
    return toEmailAccount(data);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.client.from("email_accounts").delete().eq("id", id);
    if (error) fail(error);
  }
}

const adminUserRowSchema = z.object({
  user_id: z.string(),
  name: z.string().nullable(),
  email: z.string(),
  role: z.enum(["admin", "developer"]),
  created_at: z.string(),
  last_sign_in_at: z.string().nullable(),
});

function toAdminUser(raw: unknown): AdminUser {
  const row = adminUserRowSchema.parse(raw);
  return {
    id: row.user_id,
    name: row.name,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
    lastSignInAt: row.last_sign_in_at,
  };
}

const ADMIN_USERS_FUNCTION = "admin-users";

const functionErrorSchema = z.object({ error: z.string() });

/** Traduz o código de erro que a Edge Function admin-users devolve. */
async function failFromFunction(error: unknown, email = ""): Promise<never> {
  console.error(error);
  if (error instanceof FunctionsHttpError) {
    const body: unknown = await error.context.json().catch(() => null);
    const parsed = functionErrorSchema.safeParse(body);
    const code = parsed.success ? parsed.data.error : "";
    if (code === "email_taken") throw new AdminUserEmailTakenError(email);
    if (code === "self") throw new CannotRemoveAdminUserError("self");
    if (code === "last") throw new CannotRemoveAdminUserError("last");
    if (code === "forbidden") throw new Error("Só quem tem acesso ao sistema pode mexer nos usuários.");
    if (code === "invalid") throw new Error(`Dados inválidos. Confira nome e e-mail. ${PASSWORD_RULE_HINT}`);
  }
  throw new Error("Não foi possível falar com o servidor. Tente de novo em instantes.");
}

/**
 * A lista vem da função list_admin_users (só administradores). Criar e remover exigem a chave de serviço,
 * então passam pela Edge Function admin-users, que confere de novo se quem pede é administrador.
 */
export class SupabaseAdminUserRepository implements AdminUserRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listAll(): Promise<AdminUser[]> {
    const { data, error } = await this.client.rpc("list_admin_users");
    if (error) fail(error);
    return z.array(z.unknown()).parse(data).map(toAdminUser);
  }

  async create(input: NewAdminUser): Promise<AdminUser> {
    const { data, error } = await this.client.functions.invoke(ADMIN_USERS_FUNCTION, { body: { action: "create", ...input } });
    if (error) return failFromFunction(error, input.email);
    return toAdminUser(data);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.client.functions.invoke(ADMIN_USERS_FUNCTION, { body: { action: "remove", userId: id } });
    if (error) await failFromFunction(error);
  }
}

const NOTIFICATION_COLUMNS = "id, kind, title, body, link, created_at";
const NOTIFICATION_WINDOW_DAYS = 30;
const MAX_NOTIFICATIONS = 50;

const notificationRowSchema = z.object({
  id: z.string(),
  kind: z.enum(["order", "news", "privacy", "security"]),
  title: z.string(),
  body: z.string().nullable(),
  link: z.string().nullable(),
  created_at: z.string(),
});

function toStoredNotification(raw: unknown): StoredNotification {
  const row = notificationRowSchema.parse(raw);
  return { id: row.id, kind: row.kind, title: row.title, body: row.body, link: row.link, createdAt: new Date(row.created_at).toISOString() };
}

/** Notificações dos últimos 30 dias; o que cada usuário apagou fica em `notification_dismissals` (RLS por usuário). */
export class SupabaseNotificationRepository implements AdminNotificationRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listRecent(): Promise<StoredNotification[]> {
    const since = new Date(Date.now() - NOTIFICATION_WINDOW_DAYS * 86_400_000).toISOString();
    const { data, error } = await this.client
      .from("notifications")
      .select(NOTIFICATION_COLUMNS)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(MAX_NOTIFICATIONS);
    if (error) fail(error);
    return data.map(toStoredNotification);
  }

  async listDismissed(): Promise<string[]> {
    const { data, error } = await this.client.from("notification_dismissals").select("key");
    if (error) fail(error);
    return data.map((row) => z.object({ key: z.string() }).parse(row).key);
  }

  async dismiss(keys: readonly string[]): Promise<void> {
    const { error } = await this.client
      .from("notification_dismissals")
      .upsert(
        keys.map((key) => ({ key })),
        { onConflict: "user_id,key", ignoreDuplicates: true },
      );
    if (error) fail(error);
  }
}
