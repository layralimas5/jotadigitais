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
  AdminEmailAccountRepository,
  AdminPartnerRepository,
  AdminPreferenceKey,
  AdminPreferenceRepository,
  AdminSiteContentRepository,
  AdminRevenueRepository,
  AdminStoreSettingsRepository,
  AdminTestimonialRepository,
  AdminUserRepository,
  AdminCountryRepository,
  NewOrder,
  OrderRepository,
  TestimonialRepository,
} from "@/application/ports";
import { effectiveStatus, isPurchasable, type Account, type AccountData } from "@/domain/account";
import { DEFAULT_COUNTRY, SEED_COUNTRIES, countryCodeFrom, fallbackCountryName, type Country } from "@/domain/country";
import { sameEmail, type AdminRole, type AdminUser, type AdminUserAccess, type NewAdminUser, type StaffPermission } from "@/domain/admin-user";
import {
  AccountNotFoundError,
  AccountUnavailableError,
  AdminUserEmailTakenError,
  CountryTakenError,
  CannotChangeAccessError,
  CannotRemoveAdminUserError,
  CustomerEmailTakenError,
  CustomerNotFoundError,
  ExpenseNotFoundError,
  InvalidTransitionError,
  LeadNotFoundError,
  PartnerNotFoundError,
  EmailAccountNotFoundError,
  EmailAccountTakenError,
  RevenueNotFoundError,
  SlugTakenError,
  TooManyOpenOrdersError,
} from "@/domain/errors";
import {
  RESERVATION_HOLD_MINUTES,
  canTransition,
  isCartLead,
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
import type { EmailAccount, EmailAccountData, EmailAccountListItem } from "@/domain/email-account";
import type { Partner, PartnerData } from "@/domain/partner";
import { splitCouponDiscount } from "@/domain/coupon";
import { planParts } from "@/domain/payment";
import type { SiteContent } from "@/domain/site-content";
import type { StoreSettings } from "@/domain/store-settings";
import type { Testimonial, TestimonialData } from "@/domain/testimonial";
import { applyDemoCoupon } from "./demo-coupons";
import { newId, simulateLatency, type DemoDatabase, type DemoState } from "./demo-database";
import { SEED_NEWS } from "./seed";

export const notificationsOf = (state: DemoState) => state.notifications ?? SEED_NEWS;

export const MAX_NOTIFICATIONS = 50;

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

const MAX_OPEN_ORDERS_PER_CUSTOMER = 2;
const MINUTE_MS = 60_000;

const countriesOf = (state: DemoState): Country[] => state.countries ?? [...SEED_COUNTRIES];

function countryNameIn(state: DemoState, code: string): string {
  return countriesOf(state).find((country) => country.code === code)?.name ?? fallbackCountryName(code);
}

/** Como o banco devolve a conta: reserva vencida conta como disponível e o nome do país vem junto. */
const accountView = (state: DemoState) => (account: Account): Account => {
  const country = account.country ?? DEFAULT_COUNTRY;
  return { ...account, specs: account.specs ?? null, country, countryName: countryNameIn(state, country), status: effectiveStatus(account.status, account.reservedUntil) };
};

/** Como a chave estrangeira `accounts_country_fkey`: a conta só aceita país que está na lista. */
function assertCountryExists(state: DemoState, code: string) {
  if (!countriesOf(state).some((country) => country.code === code)) throw new Error(`País ${code} não está na lista.`);
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
    const state = this.db.read();
    const accounts = state.accounts.map(accountView(state));
    return sortAccounts(
      accounts.filter((account) => matchesFilter(account, filter)),
      filter.sort,
    );
  }

  async findBySlug(slug: string): Promise<Account | null> {
    await simulateLatency();
    const state = this.db.read();
    const account = state.accounts.find((item) => item.slug === slug);
    return account ? accountView(state)(account) : null;
  }

  async findById(id: string): Promise<Account | null> {
    const state = this.db.read();
    const account = state.accounts.find((item) => item.id === id);
    return account ? accountView(state)(account) : null;
  }

  async listAll(): Promise<Account[]> {
    await simulateLatency();
    const state = this.db.read();
    return sortAccounts(state.accounts.map(accountView(state)), "recent");
  }

  async create(data: AccountData): Promise<Account> {
    await simulateLatency();
    return this.db.write((state) => {
      assertSlugFree(state, data.slug, null);
      assertCountryExists(state, data.country);
      const account: Account = { ...data, id: newId("acc"), reservedUntil: null, countryName: countryNameIn(state, data.country) };
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
      assertCountryExists(state, data.country);
      const account: Account = {
        ...data,
        id,
        reservedUntil: normalizedReservation(data.status, current.reservedUntil),
        countryName: countryNameIn(state, data.country),
      };
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

/** Espelha a tabela `countries`: lista de fábrica mais o que o painel criar. */
export class DemoCountryRepository implements AdminCountryRepository {
  constructor(private readonly db: DemoDatabase) {}

  async list(): Promise<Country[]> {
    return countriesOf(this.db.read());
  }

  async create(name: string): Promise<Country> {
    await simulateLatency();
    return this.db.write((state) => {
      const countries = countriesOf(state);
      const country: Country = { code: countryCodeFrom(name), name };
      const taken = countries.some(
        (item) => item.code === country.code || item.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"),
      );
      if (taken) throw new CountryTakenError(name);
      state.countries = [...countries, country];
      return country;
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

/** Pedidos salvos no navegador antes do pagamento dividido não têm a lista de cobranças. */
const withPayments = (order: Order): Order => ({ ...order, payments: order.payments ?? [] });

/** Pedidos salvos antes do carrinho não têm os campos dele. */
const withCart = (order: Order): Order => ({ ...withPayments(order), cartCode: order.cartCode ?? null, cartItems: [] });

/** Como `public_order_json`: só o pedido principal lista as contas do carrinho, ele primeiro. */
function withCartItems(orders: readonly Order[], order: Order): Order {
  const base = withCart(order);
  if (!isCartLead(base)) return base;
  const members = orders
    .filter((item) => item.cartCode === base.code)
    .sort((a, b) => Number(a.code !== base.code) - Number(b.code !== base.code) || b.total - a.total);
  return {
    ...base,
    cartItems: members.map((item) => ({
      code: item.code,
      accountHandle: item.accountHandle,
      accountName: item.accountName,
      accountPlatform: item.accountPlatform,
      total: item.total,
      discount: item.discount,
      status: item.status,
    })),
  };
}

/** Pedidos que seguem o principal do carrinho (sem ele). */
const cartMembersOf = (orders: readonly Order[], lead: Order) =>
  lead.cartCode === lead.code ? orders.filter((item) => item.cartCode === lead.code && item.code !== lead.code) : [];

/** Como `sync_order_status` e `sync_payments_with_order`: muda o pedido, as cobranças e a conta. */
function applyStatus(state: DemoState, order: Order, status: OrderStatus): void {
  const previous = order.status;
  order.status = status;
  if (status === "delivered") order.deliveredAt = new Date().toISOString();
  // Cancelar fecha as partes em aberto; pagar à mão dá todas como pagas.
  for (const payment of order.payments ?? []) {
    if (payment.status !== "pending") continue;
    if (status === "canceled") payment.status = "canceled";
    if (status === "paid" && previous === "awaiting_payment") {
      payment.status = "paid";
      payment.paidAt = new Date().toISOString();
    }
  }

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
      (item) => item.accountId === account.id && item.code !== order.code && isActiveOrder(item, now),
    );
    if (!otherActive && account.status === "reserved") {
      account.status = "available";
      account.reservedUntil = null;
    }
  }
}

/** Como `sync_cart_orders`: o principal saiu de "aguardando pagamento" para pago ou cancelado, o carrinho acompanha. */
function followCartLead(state: DemoState, lead: Order, status: OrderStatus): void {
  if (status !== "paid" && status !== "canceled") return;
  for (const member of cartMembersOf(state.orders, lead)) {
    if (member.status === "awaiting_payment") applyStatus(state, member, status);
  }
}

/** Espelha `place_order`, `place_cart_order` e `sync_order_status` do banco para o modo demonstração. */
export class DemoOrderRepository implements OrderRepository, AdminOrderRepository {
  constructor(private readonly db: DemoDatabase) {}

  async place(input: NewOrder): Promise<Order> {
    await simulateLatency();
    const lead = this.db.write((state) => {
      const now = Date.now();
      const email = input.customer.email?.toLowerCase() ?? null;
      const { whatsapp, document } = input.customer;
      // Como no banco, o limite conta carrinhos: várias contas compradas juntas são um pedido em aberto.
      const openCarts = new Set(
        state.orders
          .filter(
            (item) =>
              item.status === "awaiting_payment" &&
              new Date(item.expiresAt).getTime() > now &&
              ((email !== null && item.customer.email === email) || item.customer.whatsapp === whatsapp || item.customer.document === document),
          )
          .map((item) => item.cartCode ?? item.code),
      );
      if (openCarts.size >= MAX_OPEN_ORDERS_PER_CUSTOMER) throw new TooManyOpenOrdersError();

      const accounts = input.accountIds
        .map((id) => {
          const account = state.accounts.find((item) => item.id === id);
          if (!account) throw new AccountNotFoundError(id);
          if (!isPurchasable({ status: effectiveStatus(account.status, account.reservedUntil) })) {
            throw new AccountUnavailableError(account.handle);
          }
          return account;
        })
        // A mais cara é a principal, como em `place_cart_order`.
        .sort((a, b) => b.price - a.price);

      for (const stale of state.orders) {
        if (stale.status === "awaiting_payment" && accounts.some((account) => account.id === stale.accountId)) stale.status = "canceled";
      }
      const prices = accounts.map((account) => account.price);
      const subtotal = prices.reduce((sum, price) => sum + price, 0);
      const coupon = input.couponCode ? applyDemoCoupon(state, input.couponCode, subtotal) : null;
      const shares = splitCouponDiscount(prices, coupon?.discount ?? 0);
      const total = subtotal - (coupon?.discount ?? 0);
      const expiresAt = new Date(now + RESERVATION_HOLD_MINUTES * MINUTE_MS).toISOString();
      const codes = accounts.map(() => generateOrderCode());
      const cartCode = accounts.length > 1 ? (codes[0] ?? null) : null;

      const created: Order[] = accounts.map((account, index) => ({
        code: codes[index] ?? generateOrderCode(),
        accountId: account.id,
        accountHandle: account.handle,
        accountName: account.displayName,
        accountPlatform: account.platform,
        customer: { ...input.customer, email },
        paymentMethod: input.paymentMethod,
        total: account.price - (shares[index] ?? 0),
        couponCode: coupon?.code ?? null,
        discount: shares[index] ?? 0,
        status: "awaiting_payment",
        expiresAt,
        createdAt: new Date(now).toISOString(),
        deliveredAt: null,
        // Só o principal cobra, e cobra o carrinho inteiro.
        payments:
          index > 0
            ? []
            : planParts(input.paymentMethod, total, input.firstPartCents).map((part, position) => ({
                id: newId("pay"),
                position: position + 1,
                method: part.method,
                amount: part.amount,
                status: "pending",
                checkoutUrl: null,
                paidAt: null,
                requestedInstallments: null,
                card: null,
                pixCode: null,
                pix: null,
              })),
        cartCode,
        cartItems: [],
      }));
      const [first] = created;
      if (!first) throw new AccountNotFoundError("");

      state.orders.push(...created);
      state.consents = [
        ...(state.consents ?? []),
        ...input.consents.map((consent) => ({
          orderCode: first.code,
          slug: consent.slug,
          version: consent.version,
          sha256: consent.sha256,
          acceptedAt: first.createdAt,
          // Sem servidor no modo demonstração: não há IP para registrar.
          ipAddress: null,
          userAgent: navigator.userAgent.slice(0, 400),
        })),
      ];
      state.notifications = [...created.map(newOrderNotification), ...notificationsOf(state)].slice(0, MAX_NOTIFICATIONS);
      for (const account of accounts) {
        account.status = "reserved";
        account.reservedUntil = expiresAt;
      }
      return first;
    });
    return this.toPublic(withCartItems(this.db.read().orders, lead));
  }

  async findByCode(code: string): Promise<Order | null> {
    const order = this.db.read().orders.find((item) => item.code === code.trim().toUpperCase());
    return order ? this.toPublic(withCartItems(this.db.read().orders, order)) : null;
  }

  async listAll(): Promise<Order[]> {
    await simulateLatency();
    return [...this.db.read().orders].map(withCart).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async confirmPixPayment(paymentId: string): Promise<void> {
    await simulateLatency();
    this.settlePart(paymentId, "pix");
  }

  /**
   * Espelha os gatilhos de order_payments: a parte vira paga e, com todas pagas, o pedido também.
   * Também simula a volta do checkout de cartão no modo demonstração.
   */
  settlePart(paymentId: string, method: "pix" | "card"): void {
    this.db.write((state) => {
      const order = state.orders.find((item) => (item.payments ?? []).some((payment) => payment.id === paymentId));
      const part = order?.payments.find((payment) => payment.id === paymentId);
      if (!order || !part || part.method !== method || part.status !== "pending") return;
      part.status = "paid";
      part.paidAt = new Date().toISOString();
      if (method === "card") {
        part.card = { transactionNsu: `DEMO-${part.id.slice(-6)}`, installments: 1, paidAmount: part.amount, receiptUrl: null };
      }
      if (order.status === "awaiting_payment" && order.payments.every((payment) => payment.status === "paid")) {
        order.status = "paid";
        const account = state.accounts.find((item) => item.id === order.accountId);
        if (account) account.reservedUntil = null;
        followCartLead(state, order, "paid");
      }
    });
  }

  async updateStatus(code: string, status: OrderStatus): Promise<void> {
    await simulateLatency();
    this.db.write((state) => {
      const order = state.orders.find((item) => item.code === code);
      if (!order) throw new Error(`Pedido ${code} não encontrado.`);
      if (!canTransition(order.status, status)) throw new InvalidTransitionError();
      const previous = order.status;
      applyStatus(state, order, status);
      if (previous === "awaiting_payment") followCartLead(state, order, status);
    });
  }

  private toPublic(order: Order): Order {
    const { name, email } = order.customer;
    // Como `get_order` no banco: a página pública do pedido mostra só o primeiro nome, sem a ficha.
    return {
      ...order,
      customer: {
        name: name.split(" ")[0] ?? name,
        email: email ? maskEmail(email) : null,
        whatsapp: null,
        document: null,
        birthDate: null,
        instagram: null,
        city: null,
        state: null,
        source: null,
        referredBy: null,
      },
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

const byEmail = (a: EmailAccount, b: EmailAccount) => a.email.localeCompare(b.email, "pt-BR");

/** Sem banco a senha fica no navegador, em texto: o modo demo serve só para ver a tela. */
export class DemoEmailAccountRepository implements AdminEmailAccountRepository {
  constructor(private readonly db: DemoDatabase) {}

  async listAll(): Promise<EmailAccountListItem[]> {
    return [...(this.db.read().emailAccounts ?? [])]
      .sort(byEmail)
      .map(({ password, ...item }) => ({ ...item, hasPassword: password !== null }));
  }

  async findById(id: string): Promise<EmailAccount | null> {
    return (this.db.read().emailAccounts ?? []).find((item) => item.id === id) ?? null;
  }

  async findByAccountId(accountId: string): Promise<EmailAccount | null> {
    const linked = (this.db.read().emailAccounts ?? []).filter((item) => item.accountId === accountId);
    return linked.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
  }

  async findByEmail(email: string): Promise<EmailAccount | null> {
    return (this.db.read().emailAccounts ?? []).find((item) => sameEmail(item.email, email)) ?? null;
  }

  async create(data: EmailAccountData): Promise<EmailAccount> {
    await simulateLatency();
    const now = new Date().toISOString();
    const created: EmailAccount = { ...data, id: newId("eml"), createdAt: now, updatedAt: now };
    return this.db.write((state) => {
      const all = state.emailAccounts ?? [];
      if (all.some((item) => item.email === data.email)) throw new EmailAccountTakenError(data.email);
      state.emailAccounts = [...all, created];
      return created;
    });
  }

  async update(id: string, data: EmailAccountData): Promise<EmailAccount> {
    await simulateLatency();
    return this.db.write((state) => {
      const all = state.emailAccounts ?? [];
      const current = all.find((item) => item.id === id);
      if (!current) throw new EmailAccountNotFoundError();
      if (all.some((item) => item.id !== id && item.email === data.email)) throw new EmailAccountTakenError(data.email);
      const updated: EmailAccount = { ...current, ...data, updatedAt: new Date().toISOString() };
      state.emailAccounts = all.map((item) => (item.id === id ? updated : item));
      return updated;
    });
  }

  async remove(id: string): Promise<void> {
    await simulateLatency();
    this.db.write((state) => {
      state.emailAccounts = (state.emailAccounts ?? []).filter((item) => item.id !== id);
    });
  }
}

/** Sem banco não há login de verdade: a lista existe para mostrar a tela, e a senha não é guardada. */
const DEMO_OWNER: AdminUser = {
  id: "usr_owner",
  name: "Jota",
  email: "jota@jotadigitais.com.br",
  role: "admin",
  permissions: [],
  whatsapp: null,
  createdAt: "2026-10-09T12:00:00.000Z",
  lastSignInAt: null,
};

export class DemoAdminUserRepository implements AdminUserRepository {
  constructor(private readonly db: DemoDatabase) {}

  private users(state: DemoState): AdminUser[] {
    // Dados locais de antes do papel e das áreas existirem chegam sem eles.
    return (state.adminUsers ?? [DEMO_OWNER]).map((user) => ({
      ...user,
      role: user.role ?? "admin",
      permissions: user.permissions ?? [],
      whatsapp: user.whatsapp ?? null,
    }));
  }

  /** O login do modo demonstração usa para abrir o painel com o papel de quem foi cadastrado aqui. */
  accessOf(email: string): { role: AdminRole; permissions: StaffPermission[] } | null {
    const user = this.users(this.db.read()).find((item) => sameEmail(item.email, email));
    return user ? { role: user.role, permissions: user.permissions } : null;
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
        role: input.role,
        permissions: input.permissions,
        whatsapp: null,
        createdAt: new Date().toISOString(),
        lastSignInAt: null,
      };
      state.adminUsers = [...users, user];
      return user;
    });
  }

  async setAccess(id: string, access: AdminUserAccess): Promise<void> {
    await simulateLatency();
    this.db.write((state) => {
      const users = this.users(state);
      const target = users.find((user) => user.id === id);
      if (!target) throw new Error("Esse usuário não existe mais no sistema. Atualize a lista.");
      if (target.role === "developer") throw new CannotChangeAccessError("developer");
      const otherAdmins = users.filter((user) => user.role === "admin" && user.id !== id);
      if (target.role === "admin" && access.role === "helper" && otherAdmins.length === 0) throw new CannotChangeAccessError("last");
      state.adminUsers = users.map((user) => (user.id === id ? { ...user, ...access } : user));
    });
  }

  async remove(id: string): Promise<void> {
    await simulateLatency();
    this.db.write((state) => {
      const users = this.users(state);
      const target = users.find((user) => user.id === id);
      if (target?.role === "admin" && users.filter((user) => user.role === "admin").length <= 1) throw new CannotRemoveAdminUserError("last");
      state.adminUsers = users.filter((user) => user.id !== id);
    });
  }
}

export class DemoNotificationRepository implements AdminNotificationRepository {
  constructor(private readonly db: DemoDatabase) {}

  async listRecent(): Promise<StoredNotification[]> {
    return notificationsOf(this.db.read());
  }

  async listRecentForAdmin(): Promise<StoredNotification[]> {
    return this.listRecent();
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
