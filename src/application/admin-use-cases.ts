import type { Account } from "@/domain/account";
import { sameEmail, type AdminUser } from "@/domain/admin-user";
import { groupCustomers, withoutHidden, type CustomerRecord, type CustomerSummary } from "@/domain/customer";
import type { Coupon } from "@/domain/coupon";
import { sortCountries, type Country } from "@/domain/country";
import type { DashboardSource } from "@/domain/dashboard";
import { accessOf, type AccountAccess, type EmailAccount, type EmailAccountListItem } from "@/domain/email-account";
import { CannotChangeAccessError, CannotRemoveAdminUserError, InvalidTransitionError } from "@/domain/errors";
import { ACCOUNT_EXPENSE_CATEGORY, accountBalanceOf, type AccountBalance, type Expense, type Revenue } from "@/domain/finance";
import type { Cents } from "@/domain/money";
import { normalizeStageOrder, type Lead, type LeadStage } from "@/domain/lead";
import type { MessageTemplates } from "@/domain/message-template";
import type { DeliveryLogin, ProfileLogin } from "@/domain/delivery-login";
import { MAX_SAVED_DELIVERY_MESSAGES, type DeliveryMessage } from "@/domain/delivery-message";
import { TooManyDeliveryMessagesError } from "@/domain/errors";
import { buyerOrderOf, canTransition, type Order, type OrderStatus } from "@/domain/order";
import { PLATFORM_LABEL } from "@/domain/platform";
import { summarizePartners, type Partner, type PartnerSummary } from "@/domain/partner";
import type { ProfileLookup } from "@/domain/profile-lookup";
import { finalizedSales } from "@/domain/sale";
import type { SiteContent } from "@/domain/site-content";
import type { StoreSettings } from "@/domain/store-settings";
import type { Testimonial } from "@/domain/testimonial";
import type {
  AdminAccountRepository,
  AdminCustomerRepository,
  AdminCouponRepository,
  AdminCountryRepository,
  AdminDeliveryMessageRepository,
  AdminEmailAccountRepository,
  AdminProfileLoginRepository,
  AdminExpenseRepository,
  AdminLeadRepository,
  AdminMessageTemplateRepository,
  AdminOrderRepository,
  AdminPartnerRepository,
  AdminPreferenceRepository,
  AdminRevenueRepository,
  AdminSession,
  AdminSiteContentRepository,
  AdminLegalDocumentRepository,
  AdminStoreSettingsRepository,
  AdminTestimonialRepository,
  AdminNotificationRepository,
  PushNotificationService,
  AdminPrivacyRepository,
  AdminUserRepository,
  AccessRepository,
  StorageUsageReader,
  AuthService,
  SupportTicketRepository,
  AuthState,
  CalendarService,
  ProfileLookupService,
  ImageStorage,
  MediaFolder,
  MfaEnrollment,
  PreparedImage,
  ProfileUpdateResult,
  UploadedImage,
} from "./ports";
import {
  accountAccessSchema,
  deliveryMessageSchema,
  profileLoginSchema,
  accountDataSchema,
  couponDataSchema,
  changePasswordSchema,
  passwordResetSchema,
  customerRecordSchema,
  emailAccountDataSchema,
  expenseDataSchema,
  leadDataSchema,
  messageTemplatesSchema,
  mfaCodeSchema,
  adminUserAccessSchema,
  newAdminUserSchema,
  countryNameField,
  parseOrThrow,
  partnerDataSchema,
  profileSchema,
  revenueDataSchema,
  signInSchema,
  siteContentSchema,
  legalPublishSchema,
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
  legal: AdminLegalDocumentRepository;
  leads: AdminLeadRepository;
  customers: AdminCustomerRepository;
  templates: AdminMessageTemplateRepository;
  preferences: AdminPreferenceRepository;
  expenses: AdminExpenseRepository;
  revenues: AdminRevenueRepository;
  partners: AdminPartnerRepository;
  emailAccounts: AdminEmailAccountRepository;
  profileLogins: AdminProfileLoginRepository;
  deliveryMessages: AdminDeliveryMessageRepository;
  coupons: AdminCouponRepository;
  countries: AdminCountryRepository;
  users: AdminUserRepository;
  profiles: ProfileLookupService;
  notifications: AdminNotificationRepository;
  push: PushNotificationService;
  calendar: CalendarService;
  images: ImageStorage;
  privacy: AdminPrivacyRepository;
  support: SupportTicketRepository;
  access: AccessRepository;
  /** Um leitor por banco conectado: a aba Armazenamento soma todos. */
  storage: readonly StorageUsageReader[];
}

export function signIn(deps: AdminDeps, raw: unknown): Promise<AuthState> {
  const { email, password } = parseOrThrow(signInSchema, raw);
  return deps.auth.signIn(email, password);
}

/** Segunda etapa do login: o código do app autenticador. */
export function verifyMfaCode(deps: AdminDeps, raw: unknown): Promise<AdminSession> {
  const { code } = parseOrThrow(mfaCodeSchema, raw);
  return deps.auth.verifyMfa(code);
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

/** Resultado de apagar vários de uma vez: um que falhe não impede os outros. */
export interface BulkDeleteResult {
  removed: number;
  failed: number;
}

/** Apaga em paralelo. Se nenhum sair, repassa o primeiro erro para a tela mostrar. */
async function removeEach(ids: readonly string[], remove: (id: string) => Promise<void>): Promise<BulkDeleteResult> {
  const results = await Promise.allSettled(ids.map((id) => remove(id)));
  const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
  const [firstFailure] = failures;
  if (firstFailure && failures.length === results.length) throw firstFailure.reason;
  for (const failure of failures) console.error(failure.reason);
  return { removed: results.length - failures.length, failed: failures.length };
}

export function deleteAccounts(deps: AdminDeps, ids: readonly string[]): Promise<BulkDeleteResult> {
  return removeEach(ids, (id) => deps.accounts.remove(id));
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

/** Pedido de quem comprou a conta (ou reservou e ainda vai pagar). Null quando ninguém comprou. */
export async function findAccountBuyer(deps: AdminDeps, accountId: string): Promise<Order | null> {
  return buyerOrderOf(await deps.orders.listAll(), accountId);
}

export async function changeOrderStatus(deps: AdminDeps, order: Order, status: OrderStatus): Promise<void> {
  if (!canTransition(order.status, status)) throw new InvalidTransitionError();
  await deps.orders.updateStatus(order.code, status);
}

/** O Jota viu o Pix na conta. Só vale para a parte em Pix ainda aberta de um pedido esperando pagamento. */
export async function confirmPixPayment(deps: AdminDeps, order: Order, paymentId: string): Promise<void> {
  const part = order.payments.find((payment) => payment.id === paymentId);
  if (!part || part.method !== "pix" || part.status !== "pending" || order.status !== "awaiting_payment") {
    throw new InvalidTransitionError();
  }
  await deps.orders.confirmPixPayment(paymentId);
}

export async function listCustomers(deps: AdminDeps): Promise<CustomerSummary[]> {
  const [orders, records, revenues, hidden] = await Promise.all([
    deps.orders.listAll(),
    deps.customers.listAll(),
    deps.revenues.listAll(),
    deps.customers.listHidden(),
  ]);
  return withoutHidden(groupCustomers(orders, records, revenues), hidden);
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

/**
 * Apaga a ficha dos clientes escolhidos: o cadastro manual é apagado e quem tem pedido sai da lista
 * (os pedidos ficam, porque o Financeiro e a garantia dependem deles).
 */
export async function deleteCustomers(deps: AdminDeps, customers: readonly CustomerSummary[]): Promise<BulkDeleteResult> {
  const withOrders = customers.filter((customer) => customer.orders.length > 0).map((customer) => customer.key);
  if (withOrders.length > 0) await deps.customers.hide(withOrders);
  const recordIds = customers.flatMap((customer) => (customer.record ? [customer.record.id] : []));
  if (recordIds.length === 0) return { removed: customers.length, failed: 0 };
  const records = await removeEach(recordIds, (id) => deps.customers.remove(id));
  return { removed: customers.length - records.failed, failed: records.failed };
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

/** Troca só a mensagem padrão de entrega ("Conta entregue"), mantendo as outras como estão. */
export async function saveDefaultDeliveryMessage(deps: AdminDeps, body: unknown): Promise<MessageTemplates> {
  const current = await deps.templates.getAll();
  return saveMessageTemplates(deps, { ...current, order_delivered: body });
}

export function listDeliveryMessages(deps: AdminDeps): Promise<DeliveryMessage[]> {
  return deps.deliveryMessages.listAll();
}

/** Nova mensagem salva, ou troca o texto de uma que já existe (com `id`). */
export async function saveDeliveryMessage(deps: AdminDeps, id: string | null, raw: unknown): Promise<DeliveryMessage> {
  const data = parseOrThrow(deliveryMessageSchema, raw);
  if (id) return deps.deliveryMessages.update(id, data);
  const saved = await deps.deliveryMessages.listAll();
  if (saved.length >= MAX_SAVED_DELIVERY_MESSAGES) throw new TooManyDeliveryMessagesError(MAX_SAVED_DELIVERY_MESSAGES);
  return deps.deliveryMessages.create(data);
}

export function deleteDeliveryMessage(deps: AdminDeps, id: string): Promise<void> {
  return deps.deliveryMessages.remove(id);
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

/** Gastos e ganhos de uma conta, para a seção da ficha dela. */
export async function loadAccountBalance(deps: AdminDeps, accountId: string): Promise<AccountBalance> {
  return accountBalanceOf(accountId, await loadFinance(deps));
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

/** Gasto lançado pela ficha da conta: só o valor e o dia; vira despesa ligada à conta. */
export function logAccountExpense(deps: AdminDeps, account: Pick<Account, "id" | "handle">, amount: Cents, date: string): Promise<Expense> {
  return saveExpense(deps, null, {
    description: `Gasto da conta ${account.handle}`,
    category: ACCOUNT_EXPENSE_CATEGORY,
    amount,
    date,
    supplier: null,
    paymentMethod: null,
    accountId: account.id,
    notes: null,
  });
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
  const [partners, accounts, orders, records, revenues] = await Promise.all([
    deps.partners.listAll(),
    deps.accounts.listAll(),
    deps.orders.listAll(),
    deps.customers.listAll(),
    deps.revenues.listAll(),
  ]);
  return summarizePartners(partners, accounts, orders, groupCustomers(orders, records, revenues));
}

/** Parceiro com as contas, vendas e indicações dele; nulo quando não existe. */
export async function findPartnerSummary(deps: AdminDeps, id: string): Promise<PartnerSummary | null> {
  // A indicação é ligada comparando o nome com todos os parceiros, então o resumo sai da lista inteira.
  const summaries = await listPartnerSummaries(deps);
  return summaries.find((summary) => summary.partner.id === id) ?? null;
}

export function savePartner(deps: AdminDeps, id: string | null, raw: unknown): Promise<Partner> {
  const data = parseOrThrow(partnerDataSchema, raw);
  return id ? deps.partners.update(id, data) : deps.partners.create(data);
}

export function deletePartner(deps: AdminDeps, id: string): Promise<void> {
  return deps.partners.remove(id);
}

export function deletePartners(deps: AdminDeps, ids: readonly string[]): Promise<BulkDeleteResult> {
  return removeEach(ids, (id) => deps.partners.remove(id));
}

export function listEmailAccounts(deps: AdminDeps): Promise<EmailAccountListItem[]> {
  return deps.emailAccounts.listAll();
}

export function findEmailAccount(deps: AdminDeps, id: string): Promise<EmailAccount | null> {
  return deps.emailAccounts.findById(id);
}

export function saveEmailAccount(deps: AdminDeps, id: string | null, raw: unknown): Promise<EmailAccount> {
  const data = parseOrThrow(emailAccountDataSchema, raw);
  return id ? deps.emailAccounts.update(id, data) : deps.emailAccounts.create(data);
}

export interface CouponSummary {
  coupon: Coupon;
  /** Desconto dado nos pedidos não cancelados com o cupom. */
  discountGiven: number;
}

/** Cupons com o quanto cada um já tirou dos pedidos (cancelados não contam). */
export async function listCouponSummaries(deps: AdminDeps): Promise<CouponSummary[]> {
  const [coupons, orders] = await Promise.all([deps.coupons.listAll(), deps.orders.listAll()]);
  const given = new Map<string, number>();
  for (const order of orders) {
    if (!order.couponCode || order.status === "canceled") continue;
    given.set(order.couponCode, (given.get(order.couponCode) ?? 0) + order.discount);
  }
  return coupons.map((coupon) => ({ coupon, discountGiven: given.get(coupon.code) ?? 0 }));
}

export async function listAccountCountries(deps: AdminDeps): Promise<Country[]> {
  return sortCountries(await deps.countries.list());
}

/** País novo criado direto na ficha da conta. */
export function createCountry(deps: AdminDeps, rawName: unknown): Promise<Country> {
  return deps.countries.create(parseOrThrow(countryNameField, rawName));
}

export function findCoupon(deps: AdminDeps, id: string): Promise<Coupon | null> {
  return deps.coupons.findById(id);
}

export function saveCoupon(deps: AdminDeps, id: string | null, raw: unknown): Promise<Coupon> {
  const data = parseOrThrow(couponDataSchema, raw);
  return id ? deps.coupons.update(id, data) : deps.coupons.create(data);
}

export function deleteCoupon(deps: AdminDeps, id: string): Promise<void> {
  return deps.coupons.remove(id);
}

/** Login da conta (e-mail e senha), guardado na aba E-mails e ligado a ela. */
export async function findAccountAccess(deps: AdminDeps, accountId: string): Promise<AccountAccess | null> {
  return accessOf(await deps.emailAccounts.findByAccountId(accountId));
}

/** Usuário e senha do perfil na rede. */
export function findProfileLogin(deps: AdminDeps, accountId: string): Promise<ProfileLogin | null> {
  return deps.profileLogins.findByAccountId(accountId);
}

/** Usuário e senha do perfil na ficha da conta. Os dois vazios apagam o que estava anotado. */
export async function saveProfileLogin(deps: AdminDeps, accountId: string, raw: unknown): Promise<ProfileLogin | null> {
  const login = parseOrThrow(profileLoginSchema, raw);
  if (login.username === null && login.password === null) {
    await deps.profileLogins.remove(accountId);
    return null;
  }
  return deps.profileLogins.save(accountId, login);
}

/** Tudo que vai na mensagem de entrega: e-mail da conta com a senha dele e o login do perfil. */
export async function findDeliveryLogin(deps: AdminDeps, accountId: string): Promise<DeliveryLogin> {
  const [email, profile] = await Promise.all([findAccountAccess(deps, accountId), findProfileLogin(deps, accountId)]);
  return { email, profile };
}

/**
 * Salva o login preenchido na ficha da conta como um e-mail da aba E-mails, ligado à conta.
 * Já ligado: troca e-mail e senha. Já salvo sem ligação: liga. Novo: cria, com "Onde usa" apontando para a conta.
 * E-mail vazio desliga o que estava ligado, sem apagar da aba E-mails.
 */
export async function saveAccountAccess(deps: AdminDeps, account: Pick<Account, "id" | "handle" | "platform">, raw: unknown): Promise<AccountAccess | null> {
  const { email, password, device } = parseOrThrow(accountAccessSchema, raw);
  const linked = await deps.emailAccounts.findByAccountId(account.id);
  if (!email) {
    if (linked) await deps.emailAccounts.update(linked.id, { ...withoutMeta(linked), accountId: null });
    return null;
  }
  if (linked) return accessOf(await deps.emailAccounts.update(linked.id, { ...withoutMeta(linked), email, password, device }));
  const existing = await deps.emailAccounts.findByEmail(email);
  if (existing) return accessOf(await deps.emailAccounts.update(existing.id, { ...withoutMeta(existing), accountId: account.id, password, device }));
  return accessOf(
    await deps.emailAccounts.create({
      email,
      password,
      usedFor: `${PLATFORM_LABEL[account.platform]} ${account.handle}`,
      device,
      recoveryEmail: null,
      recoveryPhone: null,
      accountId: account.id,
      notes: null,
    }),
  );
}

const withoutMeta = ({ id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...data }: EmailAccount) => data;

export function deleteEmailAccount(deps: AdminDeps, id: string): Promise<void> {
  return deps.emailAccounts.remove(id);
}

export function listAdminUsers(deps: AdminDeps): Promise<AdminUser[]> {
  return deps.users.listAll();
}

export function createAdminUser(deps: AdminDeps, raw: unknown): Promise<AdminUser> {
  return deps.users.create(parseOrThrow(newAdminUserSchema, raw));
}

/** Ninguém muda o próprio acesso pelo painel; o banco confere de novo e também impede ficar sem admin. */
export function setAdminUserAccess(deps: AdminDeps, user: AdminUser, currentEmail: string, raw: unknown): Promise<void> {
  if (sameEmail(user.email, currentEmail)) throw new CannotChangeAccessError("self");
  if (user.role === "developer") throw new CannotChangeAccessError("developer");
  return deps.users.setAccess(user.id, parseOrThrow(adminUserAccessSchema, raw));
}

/** Ninguém tira o próprio acesso e o sistema nunca fica sem admin (ajudante sai sempre). O servidor confere de novo. */
export async function removeAdminUser(deps: AdminDeps, user: AdminUser, currentEmail: string): Promise<void> {
  if (sameEmail(user.email, currentEmail)) throw new CannotRemoveAdminUserError("self");
  const users = await deps.users.listAll();
  if (user.role === "admin" && users.filter((item) => item.role === "admin").length <= 1) throw new CannotRemoveAdminUserError("last");
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

/** Troca a própria foto de perfil; nulo tira a foto. */
export function updateAvatar(deps: AdminDeps, image: PreparedImage | null): Promise<void> {
  return deps.auth.updateAvatar(image);
}

export function getMfaFactorId(deps: AdminDeps): Promise<string | null> {
  return deps.auth.getMfaFactorId();
}

export function startMfaEnrollment(deps: AdminDeps): Promise<MfaEnrollment> {
  return deps.auth.startMfaEnrollment();
}

export function confirmMfaEnrollment(deps: AdminDeps, factorId: string, raw: unknown): Promise<void> {
  const { code } = parseOrThrow(mfaCodeSchema, raw);
  return deps.auth.confirmMfaEnrollment(factorId, code);
}

export function disableMfa(deps: AdminDeps, factorId: string): Promise<void> {
  return deps.auth.disableMfa(factorId);
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

export { loadLegalLibrary as getLegalLibrary } from "./legal-documents";

/** Publica os Termos e a Política: só o documento que mudou ganha versão nova. */
export async function publishLegalDocuments(deps: AdminDeps, raw: unknown): Promise<void> {
  await deps.legal.publish(parseOrThrow(legalPublishSchema, raw));
}

export function uploadImage(deps: AdminDeps, image: PreparedImage, folder: MediaFolder): Promise<UploadedImage> {
  return deps.images.upload(image, folder);
}
