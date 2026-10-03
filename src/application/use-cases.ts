import type { TikTokAccount } from "@/domain/account";
import { isPurchasable } from "@/domain/account";
import { AccountNotFoundError, AccountUnavailableError, OrderNotFoundError } from "@/domain/errors";
import { generateOrderCode, type Order } from "@/domain/order";
import type {
  AccountFilter,
  AccountRepository,
  OrderRepository,
  PaymentCharge,
  PaymentGateway,
} from "./ports";
import type { CheckoutData } from "./schemas";

export interface UseCaseDeps {
  accounts: AccountRepository;
  orders: OrderRepository;
  payments: PaymentGateway;
  now?: () => Date;
}

export function listAccounts(deps: UseCaseDeps, filter: AccountFilter): Promise<TikTokAccount[]> {
  return deps.accounts.list(filter);
}

export async function getAccount(deps: UseCaseDeps, slug: string): Promise<TikTokAccount> {
  const account = await deps.accounts.findBySlug(slug);
  if (!account) throw new AccountNotFoundError(slug);
  return account;
}

export interface PlacedOrder {
  order: Order;
  charge: PaymentCharge;
}

export async function placeOrder(
  deps: UseCaseDeps,
  accountId: string,
  data: CheckoutData,
): Promise<PlacedOrder> {
  const account = await deps.accounts.findById(accountId);
  if (!account) throw new AccountNotFoundError(accountId);
  if (!isPurchasable(account)) throw new AccountUnavailableError(account.handle);

  const order: Order = {
    code: generateOrderCode(),
    accountId: account.id,
    accountHandle: account.handle,
    customer: { name: data.name, email: data.email, whatsapp: data.whatsapp || null },
    paymentMethod: data.paymentMethod,
    total: account.price,
    status: "awaiting_payment",
    createdAt: (deps.now?.() ?? new Date()).toISOString(),
  };

  await deps.orders.save(order);
  const charge = await deps.payments.createCharge(order);
  return { order, charge };
}

export async function getOrder(deps: UseCaseDeps, code: string): Promise<Order> {
  const order = await deps.orders.findByCode(code);
  if (!order) throw new OrderNotFoundError(code);
  return order;
}
