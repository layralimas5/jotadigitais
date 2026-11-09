import type { AdminUser } from "@/domain/admin-user";
import type { CustomerRecord } from "@/domain/customer";
import type { EmailAccount, EmailAccountListItem } from "@/domain/email-account";
import { PreviewReadOnlyError } from "@/domain/errors";
import type { Lead } from "@/domain/lead";
import type { Customer, Order } from "@/domain/order";
import type { Partner } from "@/domain/partner";
import { maskEmail, maskHandle, maskNote, maskPersonName, maskPhone, maskSecret } from "@/domain/privacy-mask";
import type { DataRequest } from "@/domain/privacy";
import type { AdminDeps } from "./admin-use-cases";

// ---------------------------------------------------------------------------
// Máscaras por registro. Documento e nascimento somem (o banco já não manda o CPF para a desenvolvedora).
// ---------------------------------------------------------------------------

const maskCustomer = (customer: Customer): Customer => ({
  ...customer,
  name: maskPersonName(customer.name),
  email: maskEmail(customer.email),
  whatsapp: maskPhone(customer.whatsapp),
  document: null,
  birthDate: null,
  instagram: maskHandle(customer.instagram),
});

const maskOrder = (order: Order): Order => ({ ...order, customer: maskCustomer(order.customer) });

const maskRecord = (record: CustomerRecord): CustomerRecord => ({
  ...record,
  name: maskPersonName(record.name),
  email: maskEmail(record.email),
  whatsapp: maskPhone(record.whatsapp),
  document: null,
  birthDate: null,
  instagram: maskHandle(record.instagram),
  notes: maskNote(record.notes),
});

const maskLead = (lead: Lead): Lead => ({
  ...lead,
  name: maskPersonName(lead.name),
  whatsapp: maskPhone(lead.whatsapp),
  instagram: maskHandle(lead.instagram),
  notes: maskNote(lead.notes),
});

const maskPartner = (partner: Partner): Partner => ({
  ...partner,
  whatsapp: maskPhone(partner.whatsapp),
  pixKey: maskSecret(partner.pixKey),
  notes: maskNote(partner.notes),
});

const maskEmailItem = <T extends EmailAccountListItem | EmailAccount>(item: T): T => ({
  ...item,
  email: maskEmail(item.email) ?? item.email,
  recoveryEmail: maskEmail(item.recoveryEmail),
  recoveryPhone: maskPhone(item.recoveryPhone),
  notes: maskNote(item.notes),
});

const maskEmailAccount = (account: EmailAccount): EmailAccount => ({ ...maskEmailItem(account), password: maskSecret(account.password) });

const maskUser = (user: AdminUser): AdminUser => ({ ...user, email: maskEmail(user.email) ?? user.email });

const maskRequest = (request: DataRequest): DataRequest => ({
  ...request,
  email: maskEmail(request.email),
  whatsapp: maskPhone(request.whatsapp),
  details: maskNote(request.details),
});

const each =
  <T>(mask: (value: T) => T) =>
  (values: T[]): T[] =>
    values.map(mask);

const maybe =
  <T>(mask: (value: T) => T) =>
  (value: T | null): T | null =>
    value === null ? null : mask(value);

// ---------------------------------------------------------------------------
// Repositório só de leitura: o que está na lista passa (com máscara, se houver); o resto é recusado.
// ---------------------------------------------------------------------------

type AsyncMethod = (...args: never[]) => Promise<unknown>;

/** `null` libera a leitura como veio; uma função mascara o resultado. Método fora da lista não grava nada. */
type Reads<T> = {
  [K in keyof T]?: T[K] extends (...args: never[]) => Promise<infer R> ? ((result: R) => R) | null : never;
};

function readOnly<T extends object>(repository: T, reads: Reads<T>): T {
  return new Proxy(repository, {
    get(target, property, receiver) {
      const value: unknown = Reflect.get(target, property, receiver);
      if (typeof value !== "function") return value;
      if (!(property in reads)) return () => Promise.reject(new PreviewReadOnlyError());
      const mask = reads[property as keyof T] as ((result: unknown) => unknown) | null | undefined;
      return async (...args: never[]) => {
        const result = await (value as AsyncMethod).apply(target, args);
        return mask ? mask(result) : result;
      };
    },
  });
}

/**
 * Dependências do modo "ver como o Jota": as mesmas telas, com dados pessoais mascarados e sem gravar nada.
 * Suporte, login e Google Agenda continuam sendo os da própria desenvolvedora.
 */
export function previewAdminDeps(deps: AdminDeps): AdminDeps {
  return {
    ...deps,
    accounts: readOnly(deps.accounts, { listAll: null, findById: null }),
    testimonials: readOnly(deps.testimonials, { listAll: null, findById: null }),
    orders: readOnly(deps.orders, { listAll: each(maskOrder) }),
    settings: readOnly(deps.settings, { get: null }),
    siteContent: readOnly(deps.siteContent, { load: null }),
    legal: readOnly(deps.legal, { listCurrent: null }),
    leads: readOnly(deps.leads, { listAll: each(maskLead), findById: maybe(maskLead) }),
    customers: readOnly(deps.customers, { listAll: each(maskRecord), findById: maybe(maskRecord) }),
    templates: readOnly(deps.templates, { getAll: null }),
    preferences: readOnly(deps.preferences, { get: null }),
    expenses: readOnly(deps.expenses, { listAll: null, findById: null }),
    revenues: readOnly(deps.revenues, { listAll: null, findById: null }),
    partners: readOnly(deps.partners, { listAll: each(maskPartner), findById: maybe(maskPartner) }),
    emailAccounts: readOnly(deps.emailAccounts, {
      listAll: each(maskEmailItem),
      findById: maybe(maskEmailAccount),
      findByAccountId: maybe(maskEmailAccount),
      findByEmail: maybe(maskEmailAccount),
    }),
    users: readOnly(deps.users, { listAll: each(maskUser) }),
    profiles: readOnly(deps.profiles, { lookup: null }),
    // Apagar do sininho vale só para quem apagou: não mexe no que o Jota vê.
    notifications: {
      // O sininho é o do Jota (chamados, pedidos), não o da desenvolvedora.
      listRecent: () => deps.notifications.listRecentForAdmin(),
      listRecentForAdmin: () => deps.notifications.listRecentForAdmin(),
      listDismissed: () => deps.notifications.listDismissed(),
      dismiss: (keys) => deps.notifications.dismiss(keys),
    },
    images: readOnly(deps.images, {}),
    privacy: readOnly(deps.privacy, { listRequests: each(maskRequest) }),
  };
}
