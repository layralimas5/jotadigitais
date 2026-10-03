import type { UseCaseDeps } from "@/application/use-cases";
import { InMemoryAccountRepository } from "@/infrastructure/in-memory-account-repository";
import { LocalStorageOrderRepository } from "@/infrastructure/local-storage-order-repository";
import { PendingPaymentGateway } from "@/infrastructure/pending-payment-gateway";
import { SEED_ACCOUNTS } from "@/infrastructure/seed/accounts";

export const container: UseCaseDeps = {
  accounts: new InMemoryAccountRepository(SEED_ACCOUNTS),
  orders: new LocalStorageOrderRepository(),
  payments: new PendingPaymentGateway(),
};
