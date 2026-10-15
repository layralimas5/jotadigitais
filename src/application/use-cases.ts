import type { Account } from "@/domain/account";
import { isPurchasable } from "@/domain/account";
import { AccountNotFoundError, AccountUnavailableError, OrderNotFoundError } from "@/domain/errors";
import type { Order } from "@/domain/order";
import type { StoreSettings } from "@/domain/store-settings";
import type { Testimonial } from "@/domain/testimonial";
import type {
  AccountFilter,
  AccountRepository,
  OrderRepository,
  PaymentCharge,
  PaymentGateway,
  StoreSettingsRepository,
  TestimonialRepository,
} from "./ports";
import type { CheckoutData } from "./schemas";

export interface UseCaseDeps {
  accounts: AccountRepository;
  testimonials: TestimonialRepository;
  orders: OrderRepository;
  payments: PaymentGateway;
  settings: StoreSettingsRepository;
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
  charge: PaymentCharge;
}

export async function placeOrder(deps: UseCaseDeps, accountId: string, data: CheckoutData): Promise<PlacedOrder> {
  const account = await deps.accounts.findById(accountId);
  if (!account) throw new AccountNotFoundError(accountId);
  if (!isPurchasable(account)) throw new AccountUnavailableError(account.handle);

  const order = await deps.orders.place({
    accountId: account.id,
    customer: { name: data.name, email: data.email, whatsapp: data.whatsapp || null },
    paymentMethod: data.paymentMethod,
  });
  const charge = await deps.payments.createCharge(order);
  return { order, charge };
}

export async function getOrder(deps: UseCaseDeps, code: string): Promise<Order> {
  const order = await deps.orders.findByCode(code);
  if (!order) throw new OrderNotFoundError(code);
  return order;
}
