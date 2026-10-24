import type { AdminPrivacyRepository, PrivacyService } from "@/application/ports";
import { TooManyOpenDataRequestsError, TooManyPrivacyAttemptsError } from "@/domain/errors";
import { isReservationExpired, type Order } from "@/domain/order";
import {
  ANONYMIZED_NAME,
  PRIVACY_RESPONSE_DAYS,
  anonymizedEmail,
  generateProtocol,
  isAnonymizedEmail,
  type AnonymizationResult,
  type DataRequest,
  type DataRequestAnswer,
  type DataRequestKind,
  type OpenedDataRequest,
  type RetentionResult,
  type SubjectData,
} from "@/domain/privacy";
import { newId, simulateLatency, type DemoDatabase, type DemoState } from "./demo-database";
import { MAX_NOTIFICATIONS, notificationsOf } from "./demo-repositories";

// Mesmas regras das funções privacy_*, anonymize_* e run_retention_policy de supabase/migrations/20261026120000_lgpd.sql.

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const MAX_ATTEMPTS_PER_HOUR = 10;
const MAX_OPEN_REQUESTS = 5;

const daysAgo = (days: number) => Date.now() - days * DAY_MS;
const olderThan = (iso: string, days: number) => new Date(iso).getTime() < daysAgo(days);

function registerAttempt(state: DemoState, email: string): void {
  const attempts = (state.privacyAttempts ??= {});
  const recent = (attempts[email] ?? []).filter((at) => new Date(at).getTime() > Date.now() - HOUR_MS);
  if (recent.length >= MAX_ATTEMPTS_PER_HOUR) throw new TooManyPrivacyAttemptsError();
  attempts[email] = [...recent, new Date().toISOString()];
}

const ownsOrder = (state: DemoState, email: string, code: string) =>
  state.orders.some((order) => order.code === code && order.customer.email === email);

const clean = (email: string, code: string) => ({ email: email.trim().toLowerCase(), code: code.trim().toUpperCase() });

function subjectDataOf(state: DemoState, email: string): SubjectData {
  const orders = state.orders.filter((order) => order.customer.email === email);
  const codes = new Set(orders.map((order) => order.code));
  return {
    email,
    generatedAt: new Date().toISOString(),
    orders: [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    customers: (state.customers ?? [])
      .filter((customer) => customer.email?.toLowerCase() === email)
      .map(({ id: _id, ...customer }) => customer),
    consents: (state.consents ?? []).filter((consent) => codes.has(consent.orderCode)),
    requests: (state.dataRequests ?? [])
      .filter((request) => request.email === email)
      .map(({ id: _id, email: _email, orderCode: _orderCode, ...request }) => request),
  };
}

export class DemoPrivacyService implements PrivacyService {
  constructor(private readonly db: DemoDatabase) {}

  async lookup(rawEmail: string, rawCode: string): Promise<SubjectData | null> {
    await simulateLatency();
    const { email, code } = clean(rawEmail, rawCode);
    return this.db.write((state) => {
      registerAttempt(state, email);
      return ownsOrder(state, email, code) ? subjectDataOf(state, email) : null;
    });
  }

  async request(rawEmail: string, rawCode: string, kind: DataRequestKind, details: string | null): Promise<OpenedDataRequest | null> {
    await simulateLatency();
    const { email, code } = clean(rawEmail, rawCode);
    return this.db.write((state) => {
      registerAttempt(state, email);
      if (!ownsOrder(state, email, code)) return null;
      const requests = (state.dataRequests ??= []);
      if (requests.filter((item) => item.email === email && item.status === "open").length >= MAX_OPEN_REQUESTS) {
        throw new TooManyOpenDataRequestsError();
      }
      const now = new Date();
      const created: DataRequest = {
        id: newId("lgpd"),
        protocol: generateProtocol(),
        kind,
        email,
        orderCode: code,
        details,
        status: "open",
        response: null,
        createdAt: now.toISOString(),
        dueAt: new Date(now.getTime() + PRIVACY_RESPONSE_DAYS * DAY_MS).toISOString(),
        resolvedAt: null,
      };
      requests.push(created);
      const due = new Date(created.dueAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      state.notifications = [
        {
          id: newId("ntf"),
          kind: "privacy" as const,
          title: `Solicitação LGPD ${created.protocol}`,
          body: `Um titular abriu uma solicitação em Meus dados. Responda até ${due}.`,
          link: "/admin/privacidade",
          createdAt: created.createdAt,
        },
        ...notificationsOf(state),
      ].slice(0, MAX_NOTIFICATIONS);
      return { protocol: created.protocol, dueAt: created.dueAt };
    });
  }
}

/** Tira do pedido tudo o que identifica a pessoa, como `anonymize_orders`. */
function anonymizeOrders(state: DemoState, orders: Order[]): number {
  const codes = new Set(orders.map((order) => order.code));
  for (const order of orders) {
    order.customer = {
      name: ANONYMIZED_NAME,
      email: anonymizedEmail(order.code),
      whatsapp: null,
      document: null,
      birthDate: null,
      instagram: null,
      city: null,
      state: null,
      source: null,
      referredBy: null,
    };
  }
  for (const consent of state.consents ?? []) {
    if (codes.has(consent.orderCode)) {
      consent.ipAddress = null;
      consent.userAgent = null;
    }
  }
  state.notifications = notificationsOf(state).filter(
    (notification) => !(notification.kind === "order" && [...codes].some((code) => notification.title === `Novo pedido ${code}`)),
  );
  return orders.length;
}

const isUnpaidDead = (order: Order) => order.status === "canceled" || isReservationExpired(order);

export class DemoPrivacyRepository implements AdminPrivacyRepository {
  constructor(private readonly db: DemoDatabase) {}

  async listRequests(): Promise<DataRequest[]> {
    await simulateLatency();
    return this.db.read().dataRequests ?? [];
  }

  async answer(id: string, answer: DataRequestAnswer): Promise<void> {
    await simulateLatency();
    this.db.write((state) => {
      const request = state.dataRequests?.find((item) => item.id === id);
      if (!request) throw new Error("Solicitação não encontrada.");
      request.status = answer.status;
      request.response = answer.response;
      request.resolvedAt ??= new Date().toISOString();
    });
  }

  async anonymizeSubject(email: string): Promise<AnonymizationResult> {
    await simulateLatency();
    return this.db.write((state) => {
      const owned = state.orders.filter((order) => order.customer.email === email);
      const anonymizedOrders = anonymizeOrders(state, owned.filter(isUnpaidDead));
      const kept = state.orders.filter((order) => order.customer.email === email);
      for (const order of kept) order.customer.instagram = null;
      const before = state.customers?.length ?? 0;
      state.customers = (state.customers ?? []).filter((customer) => customer.email?.toLowerCase() !== email);
      return { anonymizedOrders, keptOrders: kept.length, deletedCustomers: before - state.customers.length };
    });
  }

  async applyRetention(): Promise<RetentionResult> {
    await simulateLatency();
    return this.db.write((state) => {
      const expired = state.orders.filter(
        (order) =>
          !isAnonymizedEmail(order.customer.email) &&
          ((isUnpaidDead(order) && olderThan(order.createdAt, 183)) ||
            ((order.status === "paid" || order.status === "delivered") && olderThan(order.createdAt, 5 * 365))),
      );
      const anonymizedOrders = anonymizeOrders(state, expired);

      const leads = state.leads ?? [];
      state.leads = leads.filter((lead) => lead.stage === "won" || !olderThan(lead.updatedAt, 365));

      const notifications = notificationsOf(state);
      state.notifications = notifications.filter(
        (notification) => notification.kind === "news" || !olderThan(notification.createdAt, 90),
      );

      const requests = state.dataRequests ?? [];
      state.dataRequests = requests.filter((request) => request.status === "open" || !olderThan(request.createdAt, 5 * 365));

      let deletedAttempts = 0;
      for (const [email, attempts] of Object.entries(state.privacyAttempts ?? {})) {
        const recent = attempts.filter((at) => !olderThan(at, 30));
        deletedAttempts += attempts.length - recent.length;
        if (state.privacyAttempts) state.privacyAttempts[email] = recent;
      }

      return {
        anonymizedOrders,
        deletedLeads: leads.length - state.leads.length,
        deletedNotifications: notifications.length - state.notifications.length,
        deletedRequests: requests.length - state.dataRequests.length,
        deletedAttempts,
      };
    });
  }
}
