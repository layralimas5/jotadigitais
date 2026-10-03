import type { PaymentCharge, PaymentGateway } from "@/application/ports";

/** Placeholder até o gateway real ser escolhido: registra o pedido e não cobra nada. */
export class PendingPaymentGateway implements PaymentGateway {
  async createCharge(): Promise<PaymentCharge> {
    await new Promise((resolve) => setTimeout(resolve, 600));
    return { kind: "pending_integration" };
  }
}
