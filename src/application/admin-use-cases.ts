import type { Account } from "@/domain/account";
import { groupCustomers, type CustomerRecord, type CustomerSummary } from "@/domain/customer";
import { InvalidTransitionError } from "@/domain/errors";
import type { Lead, LeadStage } from "@/domain/lead";
import type { MessageTemplates } from "@/domain/message-template";
import { canTransition, type Order, type OrderStatus } from "@/domain/order";
import type { StoreSettings } from "@/domain/store-settings";
import type { Testimonial } from "@/domain/testimonial";
import type {
  AdminAccountRepository,
  AdminCustomerRepository,
  AdminLeadRepository,
  AdminMessageTemplateRepository,
  AdminOrderRepository,
  AdminSession,
  AdminStoreSettingsRepository,
  AdminTestimonialRepository,
  AuthService,
  ImageStorage,
  MediaFolder,
  PreparedImage,
  UploadedImage,
} from "./ports";
import {
  accountDataSchema,
  changePasswordSchema,
  customerRecordSchema,
  leadDataSchema,
  messageTemplatesSchema,
  parseOrThrow,
  signInSchema,
  storeSettingsSchema,
  testimonialDataSchema,
} from "./schemas";

export interface AdminDeps {
  auth: AuthService;
  accounts: AdminAccountRepository;
  testimonials: AdminTestimonialRepository;
  orders: AdminOrderRepository;
  settings: AdminStoreSettingsRepository;
  leads: AdminLeadRepository;
  customers: AdminCustomerRepository;
  templates: AdminMessageTemplateRepository;
  images: ImageStorage;
}

export function signIn(deps: AdminDeps, raw: unknown): Promise<AdminSession> {
  const { email, password } = parseOrThrow(signInSchema, raw);
  return deps.auth.signIn(email, password);
}

export function listAllAccounts(deps: AdminDeps): Promise<Account[]> {
  return deps.accounts.listAll();
}

export function findAccount(deps: AdminDeps, id: string): Promise<Account | null> {
  return deps.accounts.findById(id);
}

/** Cria quando `id` é nulo, atualiza quando existe. Revalida tudo aqui, independente do formulário. */
export function saveAccount(deps: AdminDeps, id: string | null, raw: unknown): Promise<Account> {
  const data = parseOrThrow(accountDataSchema, raw);
  return id ? deps.accounts.update(id, data) : deps.accounts.create(data);
}

export function deleteAccount(deps: AdminDeps, id: string): Promise<void> {
  return deps.accounts.remove(id);
}

export function listAllTestimonials(deps: AdminDeps): Promise<Testimonial[]> {
  return deps.testimonials.listAll();
}

export function findTestimonial(deps: AdminDeps, id: string): Promise<Testimonial | null> {
  return deps.testimonials.findById(id);
}

export function saveTestimonial(deps: AdminDeps, id: string | null, raw: unknown): Promise<Testimonial> {
  const data = parseOrThrow(testimonialDataSchema, raw);
  return id ? deps.testimonials.update(id, data) : deps.testimonials.create(data);
}

export function deleteTestimonial(deps: AdminDeps, id: string): Promise<void> {
  return deps.testimonials.remove(id);
}

/** Grava a ordem da faixa do site: o primeiro id aparece primeiro. */
export function reorderTestimonials(deps: AdminDeps, ids: readonly string[]): Promise<void> {
  return deps.testimonials.reorder([...ids]);
}

export function listOrders(deps: AdminDeps): Promise<Order[]> {
  return deps.orders.listAll();
}

export async function changeOrderStatus(deps: AdminDeps, order: Order, status: OrderStatus): Promise<void> {
  if (!canTransition(order.status, status)) throw new InvalidTransitionError();
  await deps.orders.updateStatus(order.code, status);
}

export async function listCustomers(deps: AdminDeps): Promise<CustomerSummary[]> {
  const [orders, records] = await Promise.all([deps.orders.listAll(), deps.customers.listAll()]);
  return groupCustomers(orders, records);
}

export function findCustomerRecord(deps: AdminDeps, id: string): Promise<CustomerRecord | null> {
  return deps.customers.findById(id);
}

export function saveCustomerRecord(deps: AdminDeps, id: string | null, raw: unknown): Promise<CustomerRecord> {
  const data = parseOrThrow(customerRecordSchema, raw);
  return id ? deps.customers.update(id, data) : deps.customers.create(data);
}

export function deleteCustomerRecord(deps: AdminDeps, id: string): Promise<void> {
  return deps.customers.remove(id);
}

export function listLeads(deps: AdminDeps): Promise<Lead[]> {
  return deps.leads.listAll();
}

export function findLead(deps: AdminDeps, id: string): Promise<Lead | null> {
  return deps.leads.findById(id);
}

export function saveLead(deps: AdminDeps, id: string | null, raw: unknown): Promise<Lead> {
  const data = parseOrThrow(leadDataSchema, raw);
  return id ? deps.leads.update(id, data) : deps.leads.create(data);
}

export function moveLead(deps: AdminDeps, id: string, stage: LeadStage): Promise<void> {
  return deps.leads.moveToStage(id, stage);
}

export function deleteLead(deps: AdminDeps, id: string): Promise<void> {
  return deps.leads.remove(id);
}

export function getMessageTemplates(deps: AdminDeps): Promise<MessageTemplates> {
  return deps.templates.getAll();
}

export function saveMessageTemplates(deps: AdminDeps, raw: unknown): Promise<MessageTemplates> {
  return deps.templates.save(parseOrThrow(messageTemplatesSchema, raw));
}

export function changePassword(deps: AdminDeps, raw: unknown): Promise<void> {
  const { password } = parseOrThrow(changePasswordSchema, raw);
  return deps.auth.changePassword(password);
}

export function getStoreSettings(deps: AdminDeps): Promise<StoreSettings> {
  return deps.settings.get();
}

export function saveStoreSettings(deps: AdminDeps, raw: unknown): Promise<StoreSettings> {
  return deps.settings.save(parseOrThrow(storeSettingsSchema, raw));
}

export function uploadImage(deps: AdminDeps, image: PreparedImage, folder: MediaFolder): Promise<UploadedImage> {
  return deps.images.upload(image, folder);
}
