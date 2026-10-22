import type { Account } from "@/domain/account";
import { sameEmail, type AdminUser } from "@/domain/admin-user";
import { groupCustomers, type CustomerRecord, type CustomerSummary } from "@/domain/customer";
import type { DashboardSource } from "@/domain/dashboard";
import { CannotRemoveAdminUserError, InvalidTransitionError } from "@/domain/errors";
import type { Expense, Revenue } from "@/domain/finance";
import { normalizeStageOrder, type Lead, type LeadStage } from "@/domain/lead";
import type { MessageTemplates } from "@/domain/message-template";
import { canTransition, type Order, type OrderStatus } from "@/domain/order";
import { summarizePartners, type Partner, type PartnerSummary } from "@/domain/partner";
import type { ProfileLookup } from "@/domain/profile-lookup";
import { finalizedSales } from "@/domain/sale";
import type { SiteContent } from "@/domain/site-content";
import type { StoreSettings } from "@/domain/store-settings";
import type { Testimonial } from "@/domain/testimonial";
import type {
  AdminAccountRepository,
  AdminCustomerRepository,
  AdminExpenseRepository,
  AdminLeadRepository,
  AdminMessageTemplateRepository,
  AdminOrderRepository,
  AdminPartnerRepository,
  AdminPreferenceRepository,
  AdminRevenueRepository,
  AdminSession,
  AdminSiteContentRepository,
  AdminStoreSettingsRepository,
  AdminTestimonialRepository,
  AdminNotificationRepository,
  AdminPrivacyRepository,
  AdminUserRepository,
  AuthService,
  CalendarService,
  ProfileLookupService,
  ImageStorage,
  MediaFolder,
  PreparedImage,
  ProfileUpdateResult,
  UploadedImage,
} from "./ports";
import {
  accountDataSchema,
  changePasswordSchema,
  passwordResetSchema,
  customerRecordSchema,
  expenseDataSchema,
  leadDataSchema,
  messageTemplatesSchema,
  newAdminUserSchema,
  parseOrThrow,
  partnerDataSchema,
  profileSchema,
  revenueDataSchema,
  signInSchema,
  siteContentSchema,
  storeSettingsSchema,
  testimonialDataSchema,
  ValidationError,
} from "./schemas";

export interface AdminDeps {
  auth: AuthService;
  accounts: AdminAccountRepository;
  testimonials: AdminTestimonialRepository;
  orders: AdminOrderRepository;
  settings: AdminStoreSettingsRepository;
  siteContent: AdminSiteContentRepository;
  leads: AdminLeadRepository;
  customers: AdminCustomerRepository;
  templates: AdminMessageTemplateRepository;
  preferences: AdminPreferenceRepository;
  expenses: AdminExpenseRepository;
  revenues: AdminRevenueRepository;
  partners: AdminPartnerRepository;
  users: AdminUserRepository;
  profiles: ProfileLookupService;
  notifications: AdminNotificationRepository;
  calendar: CalendarService;
  images: ImageStorage;
  privacy: AdminPrivacyRepository;
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
  const [orders, records, revenues] = await Promise.all([
    deps.orders.listAll(),
    deps.customers.listAll(),
    deps.revenues.listAll(),
  ]);
  return groupCustomers(orders, records, revenues);
}

/** Só os cadastros feitos à mão, em ordem de nome (para escolher numa lista). */
export async function listCustomerRecords(deps: AdminDeps): Promise<CustomerRecord[]> {
  const records = await deps.customers.listAll();
  return [...records].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
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

export async function getCrmStageOrder(deps: AdminDeps): Promise<LeadStage[]> {
  const saved = await deps.preferences.get("crm_stage_order");
  return normalizeStageOrder(Array.isArray(saved) ? saved : null);
}

export async function saveCrmStageOrder(deps: AdminDeps, order: readonly LeadStage[]): Promise<LeadStage[]> {
  const normalized = normalizeStageOrder(order);
  await deps.preferences.set("crm_stage_order", normalized);
  return normalized;
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

export interface FinanceData {
  orders: Order[];
  revenues: Revenue[];
  expenses: Expense[];
}

/** Tudo que o Financeiro precisa; o recorte por período é feito na tela, sem buscar de novo. */
export async function loadFinance(deps: AdminDeps): Promise<FinanceData> {
  const [orders, revenues, expenses] = await Promise.all([
    deps.orders.listAll(),
    deps.revenues.listAll(),
    deps.expenses.listAll(),
  ]);
  return { orders, revenues, expenses };
}

export function findRevenue(deps: AdminDeps, id: string): Promise<Revenue | null> {
  return deps.revenues.findById(id);
}

export function saveRevenue(deps: AdminDeps, id: string | null, raw: unknown): Promise<Revenue> {
  const data = parseOrThrow(revenueDataSchema, raw);
  return id ? deps.revenues.update(id, data) : deps.revenues.create(data);
}

export function deleteRevenue(deps: AdminDeps, id: string): Promise<void> {
  return deps.revenues.remove(id);
}

export function findExpense(deps: AdminDeps, id: string): Promise<Expense | null> {
  return deps.expenses.findById(id);
}

export function saveExpense(deps: AdminDeps, id: string | null, raw: unknown): Promise<Expense> {
  const data = parseOrThrow(expenseDataSchema, raw);
  return id ? deps.expenses.update(id, data) : deps.expenses.create(data);
}

export function deleteExpense(deps: AdminDeps, id: string): Promise<void> {
  return deps.expenses.remove(id);
}

/** Tudo o que o dashboard precisa, carregado uma vez: o filtro de período recalcula sem buscar de novo. */
export async function loadDashboardSource(deps: AdminDeps): Promise<DashboardSource> {
  const [orders, expenses, revenues, accounts, leads, partners, customers] = await Promise.all([
    deps.orders.listAll(),
    deps.expenses.listAll(),
    deps.revenues.listAll(),
    deps.accounts.listAll(),
    deps.leads.listAll(),
    deps.partners.listAll(),
    deps.customers.listAll(),
  ]);
  return { orders, expenses, revenues, accounts, leads, partners, customers };
}

export interface FinalizedSalesData {
  sales: Order[];
  guaranteeDays: number;
}

/** Pedidos entregues e o prazo de garantia atual, para mostrar quem ainda está coberto. */
export interface OrdersBoardData {
  orders: Order[];
  /** Separa entregue (garantia valendo) de finalizado (garantia encerrada). */
  guaranteeDays: number;
}

export async function loadOrdersBoard(deps: AdminDeps): Promise<OrdersBoardData> {
  const [orders, settings] = await Promise.all([listOrders(deps), deps.settings.get()]);
  return { orders, guaranteeDays: settings.guaranteeDays };
}

export async function loadFinalizedSales(deps: AdminDeps): Promise<FinalizedSalesData> {
  const [orders, settings] = await Promise.all([deps.orders.listAll(), deps.settings.get()]);
  return { sales: finalizedSales(orders), guaranteeDays: settings.guaranteeDays };
}

export function listPartners(deps: AdminDeps): Promise<Partner[]> {
  return deps.partners.listAll();
}

export async function listPartnerSummaries(deps: AdminDeps): Promise<PartnerSummary[]> {
  const [partners, accounts, orders] = await Promise.all([deps.partners.listAll(), deps.accounts.listAll(), deps.orders.listAll()]);
  return summarizePartners(partners, accounts, orders);
}

/** Parceiro com as contas e vendas dele; nulo quando não existe. */
export async function findPartnerSummary(deps: AdminDeps, id: string): Promise<PartnerSummary | null> {
  const partner = await deps.partners.findById(id);
  if (!partner) return null;
  const [accounts, orders] = await Promise.all([deps.accounts.listAll(), deps.orders.listAll()]);
  return summarizePartners([partner], accounts, orders)[0] ?? null;
}

export function savePartner(deps: AdminDeps, id: string | null, raw: unknown): Promise<Partner> {
  const data = parseOrThrow(partnerDataSchema, raw);
  return id ? deps.partners.update(id, data) : deps.partners.create(data);
}

export function deletePartner(deps: AdminDeps, id: string): Promise<void> {
  return deps.partners.remove(id);
}

export function listAdminUsers(deps: AdminDeps): Promise<AdminUser[]> {
  return deps.users.listAll();
}

export function createAdminUser(deps: AdminDeps, raw: unknown): Promise<AdminUser> {
  return deps.users.create(parseOrThrow(newAdminUserSchema, raw));
}

/** Ninguém tira o próprio acesso e o sistema nunca fica sem usuário. O servidor confere de novo. */
export async function removeAdminUser(deps: AdminDeps, user: AdminUser, currentEmail: string): Promise<void> {
  if (sameEmail(user.email, currentEmail)) throw new CannotRemoveAdminUserError("self");
  const users = await deps.users.listAll();
  if (users.length <= 1) throw new CannotRemoveAdminUserError("last");
  await deps.users.remove(user.id);
}

export function lookupAccountProfile(deps: AdminDeps, url: string): Promise<ProfileLookup> {
  return deps.profiles.lookup(url.trim());
}

/** Fora do link de redefinição, a troca pede a senha atual: um aparelho esquecido logado não basta. */
export async function changePassword(deps: AdminDeps, raw: unknown, session: AdminSession): Promise<void> {
  const { currentPassword, password } = parseOrThrow(changePasswordSchema, raw);
  if (!session.recoveringPassword) {
    if (!currentPassword) {
      throw new ValidationError("Informe a senha atual.", { currentPassword: "Informe a senha atual." });
    }
    await deps.auth.verifyPassword(session.email, currentPassword);
  }
  await deps.auth.changePassword(password);
}

export function updateProfile(deps: AdminDeps, raw: unknown, emailRedirectTo: string): Promise<ProfileUpdateResult> {
  return deps.auth.updateProfile(parseOrThrow(profileSchema, raw), emailRedirectTo);
}

/** O link do e-mail entra logado em Configurações, onde a senha nova é definida. */
export function requestPasswordReset(deps: AdminDeps, raw: unknown, redirectTo: string): Promise<void> {
  const { email } = parseOrThrow(passwordResetSchema, raw);
  return deps.auth.requestPasswordReset(email, redirectTo);
}

export function getStoreSettings(deps: AdminDeps): Promise<StoreSettings> {
  return deps.settings.get();
}

export function saveStoreSettings(deps: AdminDeps, raw: unknown): Promise<StoreSettings> {
  return deps.settings.save(parseOrThrow(storeSettingsSchema, raw));
}

export { getSiteContent } from "./use-cases";

export async function saveSiteContent(deps: AdminDeps, raw: unknown): Promise<SiteContent> {
  const content = parseOrThrow(siteContentSchema, raw);
  await deps.siteContent.save(content);
  return content;
}

export function uploadImage(deps: AdminDeps, image: PreparedImage, folder: MediaFolder): Promise<UploadedImage> {
  return deps.images.upload(image, folder);
}
