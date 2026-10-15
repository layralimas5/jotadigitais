import { matchesFilter, sortAccounts } from "@/application/catalog";
import type {
  AccountFilter,
  AccountRepository,
  AdminAccountRepository,
  AdminLeadRepository,
  AdminOrderRepository,
  AdminStoreSettingsRepository,
  AdminTestimonialRepository,
  NewOrder,
  OrderRepository,
  TestimonialRepository,
} from "@/application/ports";
import { effectiveStatus, isPurchasable, type Account, type AccountData } from "@/domain/account";
import {
  AccountNotFoundError,
  AccountUnavailableError,
  InvalidTransitionError,
  LeadNotFoundError,
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
import type { Lead, LeadData, LeadStage } from "@/domain/lead";
import type { StoreSettings } from "@/domain/store-settings";
import type { Testimonial, TestimonialData } from "@/domain/testimonial";
import { newId, simulateLatency, type DemoDatabase, type DemoState } from "./demo-database";

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
      };
      state.orders.push(created);
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
    return { ...order, customer: { ...order.customer, email: maskEmail(order.customer.email), whatsapp: null } };
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
