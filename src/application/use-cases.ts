import type { Account } from "@/domain/account";
import { isPurchasable } from "@/domain/account";
import { AccountNotFoundError, AccountUnavailableError, OrderNotFoundError } from "@/domain/errors";
import type { Order } from "@/domain/order";
import { checkSplit, isSplitPlan } from "@/domain/payment";
import { DEFAULT_SITE_CONTENT, mergeWithDefaults, type SiteContent } from "@/domain/site-content";
import type { StoreSettings } from "@/domain/store-settings";
import type { Testimonial } from "@/domain/testimonial";
import type {
  AccountFilter,
  AccountRepository,
  CardPaymentReturn,
  OrderRepository,
  PaymentGateway,
  PrivacyService,
  SiteContentRepository,
  StoreSettingsRepository,
  TestimonialRepository,
} from "./ports";
import { currentLegalConsents } from "./legal-documents";
import { ValidationError, referredByFor, siteContentSchema, type CheckoutData } from "./schemas";

export interface UseCaseDeps {
  accounts: AccountRepository;
  testimonials: TestimonialRepository;
  orders: OrderRepository;
  payments: PaymentGateway;
  settings: StoreSettingsRepository;
  siteContent: SiteContentRepository;
  privacy: PrivacyService;
}

/** Textos do site: o que foi salvo por cima do padrão. Se algo salvo não passar na validação, vale o texto original. */
export async function getSiteContent(deps: Pick<UseCaseDeps, "siteContent">): Promise<SiteContent> {
  const saved = await deps.siteContent.load();
  if (saved === null || saved === undefined) return DEFAULT_SITE_CONTENT;
  const result = siteContentSchema.safeParse(mergeWithDefaults(saved));
  if (result.success) return result.data;
  console.error("Textos do site salvos com formato inválido; usando o texto original.", result.error);
  return DEFAULT_SITE_CONTENT;
}

export function getStoreSettings(deps: UseCaseDeps): Promise<StoreSettings> {
  return deps.settings.get();
}

export function listAccounts(deps: UseCaseDeps, filter: AccountFilter): Promise<Account[]> {
  return deps.accounts.list(filter);
}

export async function getAccount(deps: UseCaseDeps, slug: string): Promise<Account> {
  const account = await deps.accounts.findBySlug(slug);
  if (!account) throw new AccountNotFoundError(slug);
  return account;
}

export function listTestimonials(deps: UseCaseDeps): Promise<Testimonial[]> {
  return deps.testimonials.listPublished();
}

export interface PlacedOrder {
  order: Order;
}

export async function placeOrder(deps: UseCaseDeps, accountId: string, data: CheckoutData): Promise<PlacedOrder> {
  const account = await deps.accounts.findById(accountId);
  if (!account) throw new AccountNotFoundError(accountId);
  if (!isPurchasable(account)) throw new AccountUnavailableError(account.handle);
  const split = isSplitPlan(data.paymentMethod);
  if (split) {
    const check = checkSplit(account.price, data.firstPartCents);
    if (!check.ok) throw new ValidationError(check.message, { firstPartCents: check.message });
  }

  const order = await deps.orders.place({
    accountId: account.id,
    customer: {
      name: data.name,
      email: null,
      whatsapp: data.whatsapp,
      document: data.document,
      birthDate: null,
      instagram: null,
      city: null,
      state: null,
      source: data.source,
      referredBy: referredByFor(data),
    },
    paymentMethod: data.paymentMethod,
    firstPartCents: split ? data.firstPartCents : null,
    installments: data.paymentMethod === "card" ? data.installments : null,
    consents: await currentLegalConsents(),
  });
  return { order };
}

/** Leva o cliente ao checkout de cartão daquela parte do pedido. */
export function startCardPayment(deps: UseCaseDeps, orderCode: string, paymentId: string): Promise<string> {
  return deps.payments.cardCheckoutUrl(orderCode, paymentId);
}

export function confirmCardReturn(deps: UseCaseDeps, payment: CardPaymentReturn): Promise<boolean> {
  return deps.payments.confirmCardReturn(payment);
}

export async function getOrder(deps: UseCaseDeps, code: string): Promise<Order> {
  const order = await deps.orders.findByCode(code);
  if (!order) throw new OrderNotFoundError(code);
  return order;
}
