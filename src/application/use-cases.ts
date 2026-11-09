import type { Account } from "@/domain/account";
import { isListedInStore, isPurchasable } from "@/domain/account";
import { AccountNotFoundError, AccountUnavailableError, OrderNotFoundError } from "@/domain/errors";
import type { CouponPreview } from "@/domain/coupon";
import { sortCountries, type Country } from "@/domain/country";
import { MAX_CART_ITEMS, type Order } from "@/domain/order";
import { checkSplit, isSplitPlan } from "@/domain/payment";
import { DEFAULT_SITE_CONTENT, mergeWithDefaults, type SiteContent } from "@/domain/site-content";
import type { StoreSettings } from "@/domain/store-settings";
import type { Testimonial } from "@/domain/testimonial";
import type {
  AccountFilter,
  AccountRepository,
  CardPaymentReturn,
  CouponService,
  CountryRepository,
  OrderRepository,
  PaymentGateway,
  PrivacyService,
  SiteContentRepository,
  LegalDocumentRepository,
  StoreSettingsRepository,
  TestimonialRepository,
} from "./ports";
import { currentLegalConsents } from "./legal-documents";
import { ValidationError, couponCodeField, parseOrThrow, referredByFor, siteContentSchema, type CheckoutData } from "./schemas";

export interface UseCaseDeps {
  accounts: AccountRepository;
  testimonials: TestimonialRepository;
  orders: OrderRepository;
  payments: PaymentGateway;
  settings: StoreSettingsRepository;
  siteContent: SiteContentRepository;
  legal: LegalDocumentRepository;
  privacy: PrivacyService;
  coupons: CouponService;
  countries: CountryRepository;
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

/** Vitrine pública: catálogo, destaques da home e contas parecidas. */
export async function listAccounts(deps: UseCaseDeps, filter: AccountFilter): Promise<Account[]> {
  const accounts = await deps.accounts.list(filter);
  return accounts.filter(isListedInStore);
}

/** Países da vitrine (filtro), Brasil primeiro. */
export async function listCountries(deps: Pick<UseCaseDeps, "countries">): Promise<Country[]> {
  return sortCountries(await deps.countries.list());
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

/** Contas do carrinho guardado no navegador. As que saíram do estoque (apagadas) somem; vendidas e reservadas voltam para o aviso. */
export async function getCartAccounts(deps: Pick<UseCaseDeps, "accounts">, ids: readonly string[]): Promise<Account[]> {
  const found = await Promise.all(ids.map((id) => deps.accounts.findById(id)));
  return found.filter((account): account is Account => account !== null);
}

function checkCartSize(accountIds: readonly string[]): void {
  const distinct = new Set(accountIds).size;
  if (distinct === 0 || distinct !== accountIds.length || distinct > MAX_CART_ITEMS) {
    const message = `O carrinho aceita de 1 a ${MAX_CART_ITEMS} contas diferentes.`;
    throw new ValidationError(message, { cart: message });
  }
}

/** Desconto do cupom sobre as contas, conferido no banco. A prévia é só para mostrar: o pedido confere de novo. */
export function previewCoupon(deps: Pick<UseCaseDeps, "coupons">, rawCode: string, accountIds: string[]): Promise<CouponPreview> {
  checkCartSize(accountIds);
  const code = parseOrThrow(couponCodeField, rawCode);
  return deps.coupons.preview(code, accountIds);
}

async function purchasableAccounts(deps: Pick<UseCaseDeps, "accounts">, accountIds: readonly string[]): Promise<Account[]> {
  checkCartSize(accountIds);
  return Promise.all(
    accountIds.map(async (id) => {
      const account = await deps.accounts.findById(id);
      if (!account) throw new AccountNotFoundError(id);
      if (!isPurchasable(account)) throw new AccountUnavailableError(account.handle);
      return account;
    }),
  );
}

/** Uma conta é o checkout normal; várias são o carrinho, com um pagamento só para todas. */
export async function placeOrder(deps: UseCaseDeps, accountIds: string[], data: CheckoutData): Promise<PlacedOrder> {
  const accounts = await purchasableAccounts(deps, accountIds);
  const subtotal = accounts.reduce((sum, account) => sum + account.price, 0);
  const total = data.couponCode ? (await deps.coupons.preview(data.couponCode, accountIds)).total : subtotal;
  const split = isSplitPlan(data.paymentMethod);
  if (split) {
    const check = checkSplit(total, data.firstPartCents);
    if (!check.ok) throw new ValidationError(check.message, { firstPartCents: check.message });
  }

  const order = await deps.orders.place({
    accountIds,
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
    couponCode: data.couponCode,
    consents: await currentLegalConsents(deps),
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

export function startPixPayment(deps: UseCaseDeps, orderCode: string, paymentId: string): Promise<string | null> {
  return deps.payments.pixChargeCode(orderCode, paymentId);
}

export function checkPixPayment(deps: UseCaseDeps, orderCode: string, paymentId: string): Promise<boolean> {
  return deps.payments.checkPixPayment(orderCode, paymentId);
}

export async function getOrder(deps: UseCaseDeps, code: string): Promise<Order> {
  const order = await deps.orders.findByCode(code);
  if (!order) throw new OrderNotFoundError(code);
  return order;
}
