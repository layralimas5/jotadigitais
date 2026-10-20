import { matchesFilter, sortAccounts } from "@/application/catalog";
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
import { effectiveStatus, isPurchasable, type Account, type AccountData } from "@/domain/account";
import { sameEmail, type AdminUser, type NewAdminUser } from "@/domain/admin-user";
import {
  AccountNotFoundError,
  AccountUnavailableError,
  AdminUserEmailTakenError,
  CannotRemoveAdminUserError,
  CustomerEmailTakenError,
  CustomerNotFoundError,
  ExpenseNotFoundError,
  InvalidTransitionError,
  LeadNotFoundError,
  PartnerNotFoundError,
  RevenueNotFoundError,
  SlugTakenError,
  TooManyOpenOrdersError,
} from "@/domain/errors";
import {
  RESERVATION_HOLD_MINUTES,
  canTransition,
  generateOrderCode,
  maskEmail,
  type Order,
  type OrderStatus,
} from "@/domain/order";
import type { CustomerRecord, CustomerRecordData } from "@/domain/customer";
import type { Expense, ExpenseData, Revenue, RevenueData } from "@/domain/finance";
import type { Lead, LeadData, LeadStage } from "@/domain/lead";
import { DEFAULT_MESSAGE_TEMPLATES, type MessageTemplates } from "@/domain/message-template";
import { formatBRL } from "@/domain/money";
import type { StoredNotification } from "@/domain/notification";
import type { Partner, PartnerData } from "@/domain/partner";
import type { SiteContent } from "@/domain/site-content";
import type { StoreSettings } from "@/domain/store-settings";
import type { Testimonial, TestimonialData } from "@/domain/testimonial";
import { newId, simulateLatency, type DemoDatabase, type DemoState } from "./demo-database";
import { SEED_NEWS } from "./seed";

const notificationsOf = (state: DemoState) => state.notifications ?? SEED_NEWS;

const MAX_NOTIFICATIONS = 50;

/** Mesmo texto do gatilho `notify_new_order` do banco. */
function newOrderNotification(order: Order): StoredNotification {
  return {
    id: newId("ntf"),
    kind: "order",
    title: `Novo pedido ${order.code}`,
    body: `${order.customer.name} pediu ${order.accountHandle} por ${formatBRL(order.total)}. Aguardando pagamento.`,
    link: "/admin/pedidos",
    createdAt: order.createdAt,
  };
}

const MAX_OPEN_ORDERS_PER_EMAIL = 2;
const MINUTE_MS = 60_000;

function withEffectiveStatus(account: Account): Account {
  return { ...account, status: effectiveStatus(account.status, account.reservedUntil) };
}

/** Mesma regra do gatilho `normalize_reservation`. */
function normalizedReservation(status: Account["status"], reservedUntil: string | null): string | null {
  if (status !== "reserved" || !reservedUntil) return null;
  return new Date(reservedUntil).getTime() > Date.now() ? reservedUntil : null;
}

function assertSlugFree(state: DemoState, slug: string, ignoreId: string | null) {
  if (state.accounts.some((account) => account.slug === slug && account.id !== ignoreId)) throw new SlugTakenError(slug);
}

export class DemoAccountRepository implements AccountRepository, AdminAccountRepository {
  constructor(private readonly db: DemoDatabase) {}

  async list(filter: AccountFilter): Promise<Account[]> {
    await simulateLatency();
    const accounts = this.db.read().accounts.map(withEffectiveStatus);
    return sortAccounts(
      accounts.filter((account) => matchesFilter(account, filter)),
      filter.sort,
    );
  }

  async findBySlug(slug: string): Promise<Account | null> {
    await simulateLatency();
    const account = this.db.read().accounts.find((item) => item.slug === slug);
    return account ? withEffectiveStatus(account) : null;
  }

  async findById(id: string): Promise<Account | null> {
    const account = this.db.read().accounts.find((item) => item.id === id);
    return account ? withEffectiveStatus(account) : null;
  }

  async listAll(): Promise<Account[]> {
    await simulateLatency();
    return sortAccounts(this.db.read().accounts.map(withEffectiveStatus), "recent");
  }

  async create(data: AccountData): Promise<Account> {
    await simulateLatency();
    return this.db.write((state) => {
      assertSlugFree(state, data.slug, null);
      const account: Account = { ...data, id: newId("acc"), reservedUntil: null };
      state.accounts.push(account);
      return account;
    });
  }

  async update(id: string, data: AccountData): Promise<Account> {
    await simulateLatency();
    return this.db.write((state) => {
      assertSlugFree(state, data.slug, id);
      const index = state.accounts.findIndex((account) => account.id === id);
      const current = state.accounts[index];
      if (!current) throw new AccountNotFoundError(id);
      const account: Account = { ...data, id, reservedUntil: normalizedReservation(data.status, current.reservedUntil) };
      state.accounts[index] = account;
      return account;
    });
  }

  async remove(id: string): Promise<void> {
    await simulateLatency();
    this.db.write((state) => {
      state.accounts = state.accounts.filter((account) => account.id !== id);
      for (const order of state.orders) if (order.accountId === id) order.accountId = null;
    });
  }
}

export class DemoTestimonialRepository implements TestimonialRepository, AdminTestimonialRepository {
  constructor(private readonly db: DemoDatabase) {}

  private sorted(): Testimonial[] {
    return [...this.db.read().testimonials].sort((a, b) => a.position - b.position);
  }

  async listPublished(): Promise<Testimonial[]> {
    await simulateLatency();
    return this.sorted().filter((item) => item.published);
  }

  async listAll(): Promise<Testimonial[]> {
    await simulateLatency();
    return this.sorted();
  }

  async findById(id: string): Promise<Testimonial | null> {
    return this.db.read().testimonials.find((item) => item.id === id) ?? null;
  }

  async create(data: TestimonialData): Promise<Testimonial> {
    await simulateLatency();
    return this.db.write((state) => {
      const position = Math.max(-1, ...state.testimonials.map((item) => item.position)) + 1;
      const testimonial: Testimonial = { ...data, id: newId("tst"), position };
      state.testimonials.push(testimonial);
      return testimonial;
    });
  }

  async update(id: string, data: TestimonialData): Promise<Testimonial> {
    await simulateLatency();
    return this.db.write((state) => {
      const index = state.testimonials.findIndex((item) => item.id === id);
      const current = state.testimonials[index];
      if (!current) throw new Error("Depoimento não encontrado.");
      const testimonial: Testimonial = { ...data, id, position: current.position };
      state.testimonials[index] = testimonial;
      return testimonial;
    });
  }

  async remove(id: string): Promise<void> {
    await simulateLatency();
    this.db.write((state) => {
      state.testimonials = state.testimonials.filter((item) => item.id !== id);
    });
  }

  async reorder(ids: string[]): Promise<void> {
    this.db.write((state) => {
      for (const item of state.testimonials) {
        const position = ids.indexOf(item.id);
        if (position !== -1) item.position = position;
      }
    });
  }
}

function isActiveOrder(order: Order, now: number): boolean {
  return (
    order.status === "paid" ||
    order.status === "delivered" ||
    (order.status === "awaiting_payment" && new Date(order.expiresAt).getTime() > now)
  );
}

/** Espelha `place_order` e `sync_order_status` do banco para o modo demonstração. */
export class DemoOrderRepository implements OrderRepository, AdminOrderRepository {
  constructor(private readonly db: DemoDatabase) {}

  async place(input: NewOrder): Promise<Order> {
    await simulateLatency();
    const order = this.db.write((state) => {
      const now = Date.now();
      const email = input.customer.email.toLowerCase();
      const open = state.orders.filter(
        (item) => item.customer.email === email && item.status === "awaiting_payment" && new Date(item.expiresAt).getTime() > now,
      );
      if (open.length >= MAX_OPEN_ORDERS_PER_EMAIL) throw new TooManyOpenOrdersError();

      const account = state.accounts.find((item) => item.id === input.accountId);
      if (!account) throw new AccountNotFoundError(input.accountId);
      if (!isPurchasable({ status: effectiveStatus(account.status, account.reservedUntil) })) {
        throw new AccountUnavailableError(account.handle);
      }

      for (const stale of state.orders) {
        if (stale.accountId === account.id && stale.status === "awaiting_payment") stale.status = "canceled";
      }

      const created: Order = {
        code: generateOrderCode(),
        accountId: account.id,
        accountHandle: account.handle,
        accountName: account.displayName,
        accountPlatform: account.platform,
        customer: { ...input.customer, email },
        paymentMethod: input.paymentMethod,
        total: account.price,
        status: "awaiting_payment",
        expiresAt: new Date(now + RESERVATION_HOLD_MINUTES * MINUTE_MS).toISOString(),
        createdAt: new Date(now).toISOString(),
        deliveredAt: null,
      };
      state.orders.push(created);
      state.notifications = [newOrderNotification(created), ...notificationsOf(state)].slice(0, MAX_NOTIFICATIONS);
      account.status = "reserved";
      account.reservedUntil = created.expiresAt;
      return created;
    });
    return this.toPublic(order);
  }

  async findByCode(code: string): Promise<Order | null> {
    const order = this.db.read().orders.find((item) => item.code === code.trim().toUpperCase());
    return order ? this.toPublic(order) : null;
  }

  async listAll(): Promise<Order[]> {
    await simulateLatency();
    return [...this.db.read().orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async updateStatus(code: string, status: OrderStatus): Promise<void> {
    await simulateLatency();
    this.db.write((state) => {
      const order = state.orders.find((item) => item.code === code);
      if (!order) throw new Error(`Pedido ${code} não encontrado.`);
      if (!canTransition(order.status, status)) throw new InvalidTransitionError();
      order.status = status;
      if (status === "delivered") order.deliveredAt = new Date().toISOString();

      const account = state.accounts.find((item) => item.id === order.accountId);
      if (!account) return;
      if (status === "paid") {
        account.status = "reserved";
        account.reservedUntil = null;
      } else if (status === "delivered") {
        account.status = "sold";
        account.reservedUntil = null;
      } else if (status === "canceled") {
        const now = Date.now();
        const otherActive = state.orders.some(
          (item) => item.accountId === account.id && item.code !== code && isActiveOrder(item, now),
        );
        if (!otherActive && account.status === "reserved") {
          account.status = "available";
          account.reservedUntil = null;
        }
      }
    });
  }

  private toPublic(order: Order): Order {
    const { name, email } = order.customer;
    // Como `get_order` no banco: a página pública do pedido não mostra a ficha.
    return {
      ...order,
      customer: { name, email: maskEmail(email), whatsapp: null, document: null, birthDate: null, instagram: null, city: null, state: null },
    };
  }
}

export class DemoSiteContentRepository implements AdminSiteContentRepository {
  constructor(private readonly db: DemoDatabase) {}

  async load(): Promise<unknown> {
    return this.db.read().siteContent ?? null;
  }

  async save(content: SiteContent): Promise<void> {
    await simulateLatency();
    this.db.write((state) => {
      state.siteContent = content;
    });
  }
}

export class DemoStoreSettingsRepository implements AdminStoreSettingsRepository {
  constructor(
    private readonly db: DemoDatabase,
    private readonly defaults: StoreSettings,
  ) {}

  async get(): Promise<StoreSettings> {
    return this.db.read().settings ?? this.defaults;
  }

  async save(settings: StoreSettings): Promise<StoreSettings> {
    await simulateLatency();
    return this.db.write((state) => {
      state.settings = settings;
      return settings;
    });
  }
}

const byFollowUpThenRecent = (a: Lead, b: Lead) =>
  (a.nextFollowUp ?? "9999").localeCompare(b.nextFollowUp ?? "9999") || b.updatedAt.localeCompare(a.updatedAt);

export class DemoLeadRepository implements AdminLeadRepository {
  constructor(private readonly db: DemoDatabase) {}

  async listAll(): Promise<Lead[]> {
    await simulateLatency();
    return [...(this.db.read().leads ?? [])].sort(byFollowUpThenRecent);
  }

  async findById(id: string): Promise<Lead | null> {
    return (this.db.read().leads ?? []).find((lead) => lead.id === id) ?? null;
  }

  async create(data: LeadData): Promise<Lead> {
    await simulateLatency();
    const now = new Date().toISOString();
    const lead: Lead = { ...data, id: newId("lead"), createdAt: now, updatedAt: now };
    return this.db.write((state) => {
      state.leads = [lead, ...(state.leads ?? [])];
      return lead;
    });
  }

  async update(id: string, data: LeadData): Promise<Lead> {
    await simulateLatency();
    return this.db.write((state) => {
      const current = (state.leads ?? []).find((lead) => lead.id === id);
      if (!current) throw new LeadNotFoundError();
      const updated: Lead = { ...current, ...data, updatedAt: new Date().toISOString() };
      state.leads = (state.leads ?? []).map((lead) => (lead.id === id ? updated : lead));
      return updated;
    });
  }

  async moveToStage(id: string, stage: LeadStage): Promise<void> {
    const current = await this.findById(id);
    if (!current) throw new LeadNotFoundError();
    await this.update(id, { ...current, stage });
  }

  async remove(id: string): Promise<void> {
    await simulateLatency();
    this.db.write((state) => {
      state.leads = (state.leads ?? []).filter((lead) => lead.id !== id);
    });
  }
}

function assertEmailFree(records: readonly CustomerRecord[], email: string | null, ignoreId: string | null) {
  if (!email) return;
  const taken = records.some((record) => record.id !== ignoreId && record.email?.toLowerCase() === email.toLowerCase());
  if (taken) throw new CustomerEmailTakenError(email);
}

export class DemoCustomerRepository implements AdminCustomerRepository {
  constructor(private readonly db: DemoDatabase) {}

  async listAll(): Promise<CustomerRecord[]> {
    return this.db.read().customers ?? [];
  }

  async findById(id: string): Promise<CustomerRecord | null> {
    return (this.db.read().customers ?? []).find((record) => record.id === id) ?? null;
  }

  async create(data: CustomerRecordData): Promise<CustomerRecord> {
    await simulateLatency();
    return this.db.write((state) => {
      const records = state.customers ?? [];
      assertEmailFree(records, data.email, null);
      const record: CustomerRecord = { ...data, id: newId("cust"), createdAt: new Date().toISOString() };
      state.customers = [record, ...records];
      return record;
    });
  }

  async update(id: string, data: CustomerRecordData): Promise<CustomerRecord> {
    await simulateLatency();
    return this.db.write((state) => {
      const records = state.customers ?? [];
      const current = records.find((record) => record.id === id);
      if (!current) throw new CustomerNotFoundError();
      assertEmailFree(records, data.email, id);
      const updated: CustomerRecord = { ...current, ...data };
      state.customers = records.map((record) => (record.id === id ? updated : record));
      return updated;
    });
  }

  async remove(id: string): Promise<void> {
    await simulateLatency();
    this.db.write((state) => {
      state.customers = (state.customers ?? []).filter((record) => record.id !== id);
    });
  }
}

export class DemoMessageTemplateRepository implements AdminMessageTemplateRepository {
  constructor(private readonly db: DemoDatabase) {}

  async getAll(): Promise<MessageTemplates> {
    return { ...DEFAULT_MESSAGE_TEMPLATES, ...this.db.read().messageTemplates };
  }

  async save(templates: MessageTemplates): Promise<MessageTemplates> {
    await simulateLatency();
    return this.db.write((state) => {
      state.messageTemplates = templates;
      return templates;
    });
  }
}

export class DemoPreferenceRepository implements AdminPreferenceRepository {
  constructor(private readonly db: DemoDatabase) {}

  async get(key: AdminPreferenceKey): Promise<unknown> {
    return this.db.read().preferences?.[key] ?? null;
  }

  async set(key: AdminPreferenceKey, value: unknown): Promise<void> {
    this.db.write((state) => {
      state.preferences = { ...state.preferences, [key]: value };
    });
  }
}

const byDateDesc = (a: Expense, b: Expense) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);

export class DemoExpenseRepository implements AdminExpenseRepository {
  constructor(private readonly db: DemoDatabase) {}

  async listAll(): Promise<Expense[]> {
    return [...(this.db.read().expenses ?? [])].sort(byDateDesc);
  }

  async findById(id: string): Promise<Expense | null> {
    return (this.db.read().expenses ?? []).find((expense) => expense.id === id) ?? null;
  }

  async create(data: ExpenseData): Promise<Expense> {
    await simulateLatency();
    const expense: Expense = { ...data, id: newId("exp"), createdAt: new Date().toISOString() };
    return this.db.write((state) => {
      state.expenses = [expense, ...(state.expenses ?? [])];
      return expense;
    });
  }

  async update(id: string, data: ExpenseData): Promise<Expense> {
    await simulateLatency();
    return this.db.write((state) => {
      const current = (state.expenses ?? []).find((expense) => expense.id === id);
      if (!current) throw new ExpenseNotFoundError();
      const updated: Expense = { ...current, ...data };
      state.expenses = (state.expenses ?? []).map((expense) => (expense.id === id ? updated : expense));
      return updated;
    });
  }

  async remove(id: string): Promise<void> {
    await simulateLatency();
    this.db.write((state) => {
      state.expenses = (state.expenses ?? []).filter((expense) => expense.id !== id);
    });
  }
}

const revenuesByDateDesc = (a: Revenue, b: Revenue) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);

export class DemoRevenueRepository implements AdminRevenueRepository {
  constructor(private readonly db: DemoDatabase) {}

  async listAll(): Promise<Revenue[]> {
    return [...(this.db.read().revenues ?? [])].sort(revenuesByDateDesc);
  }

  async findById(id: string): Promise<Revenue | null> {
    return (this.db.read().revenues ?? []).find((revenue) => revenue.id === id) ?? null;
  }

  async create(data: RevenueData): Promise<Revenue> {
    await simulateLatency();
    const revenue: Revenue = { ...data, id: newId("rev"), createdAt: new Date().toISOString() };
    return this.db.write((state) => {
      state.revenues = [revenue, ...(state.revenues ?? [])];
      return revenue;
    });
  }

  async update(id: string, data: RevenueData): Promise<Revenue> {
    await simulateLatency();
    return this.db.write((state) => {
      const current = (state.revenues ?? []).find((revenue) => revenue.id === id);
      if (!current) throw new RevenueNotFoundError();
      const updated: Revenue = { ...current, ...data };
      state.revenues = (state.revenues ?? []).map((revenue) => (revenue.id === id ? updated : revenue));
      return updated;
    });
  }

  async remove(id: string): Promise<void> {
    await simulateLatency();
    this.db.write((state) => {
      state.revenues = (state.revenues ?? []).filter((revenue) => revenue.id !== id);
    });
  }
}

const byName = (a: Partner, b: Partner) => a.name.localeCompare(b.name, "pt-BR");

export class DemoPartnerRepository implements AdminPartnerRepository {
  constructor(private readonly db: DemoDatabase) {}

  async listAll(): Promise<Partner[]> {
    return [...(this.db.read().partners ?? [])].sort(byName);
  }

  async findById(id: string): Promise<Partner | null> {
    return (this.db.read().partners ?? []).find((partner) => partner.id === id) ?? null;
  }

  async create(data: PartnerData): Promise<Partner> {
    await simulateLatency();
    const partner: Partner = { ...data, id: newId("ptn"), createdAt: new Date().toISOString() };
    return this.db.write((state) => {
      state.partners = [...(state.partners ?? []), partner];
      return partner;
    });
  }

  async update(id: string, data: PartnerData): Promise<Partner> {
    await simulateLatency();
    return this.db.write((state) => {
      const current = (state.partners ?? []).find((partner) => partner.id === id);
      if (!current) throw new PartnerNotFoundError();
      const updated: Partner = { ...current, ...data };
      state.partners = (state.partners ?? []).map((partner) => (partner.id === id ? updated : partner));
      return updated;
    });
  }

  async remove(id: string): Promise<void> {
    await simulateLatency();
    this.db.write((state) => {
      state.partners = (state.partners ?? []).filter((partner) => partner.id !== id);
      for (const account of state.accounts) if (account.partnerId === id) account.partnerId = null;
    });
  }
}

/** Sem banco não há login de verdade: a lista existe para mostrar a tela, e a senha não é guardada. */
const DEMO_OWNER: AdminUser = {
  id: "usr_owner",
  name: "Jota",
  email: "jota@jotadigitais.com.br",
  createdAt: "2026-10-09T12:00:00.000Z",
  lastSignInAt: null,
};

export class DemoAdminUserRepository implements AdminUserRepository {
  constructor(private readonly db: DemoDatabase) {}

  private users(state: DemoState): AdminUser[] {
    return state.adminUsers ?? [DEMO_OWNER];
  }

  async listAll(): Promise<AdminUser[]> {
    await simulateLatency();
    return this.users(this.db.read());
  }

  async create(input: NewAdminUser): Promise<AdminUser> {
    await simulateLatency();
    return this.db.write((state) => {
      const users = this.users(state);
      if (users.some((user) => sameEmail(user.email, input.email))) throw new AdminUserEmailTakenError(input.email);
      const user: AdminUser = {
        id: newId("usr"),
        name: input.name,
        email: input.email,
        createdAt: new Date().toISOString(),
        lastSignInAt: null,
      };
      state.adminUsers = [...users, user];
      return user;
    });
  }

  async remove(id: string): Promise<void> {
    await simulateLatency();
    this.db.write((state) => {
      const users = this.users(state);
      if (users.length <= 1) throw new CannotRemoveAdminUserError("last");
      state.adminUsers = users.filter((user) => user.id !== id);
    });
  }
}

export class DemoNotificationRepository implements AdminNotificationRepository {
  constructor(private readonly db: DemoDatabase) {}

  async listRecent(): Promise<StoredNotification[]> {
    return notificationsOf(this.db.read());
  }

  async listDismissed(): Promise<string[]> {
    return this.db.read().dismissedNotifications ?? [];
  }

  async dismiss(keys: readonly string[]): Promise<void> {
    this.db.write((state) => {
      state.dismissedNotifications = [...new Set([...(state.dismissedNotifications ?? []), ...keys])];
    });
  }
}
