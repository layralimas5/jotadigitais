import type { PaymentGateway } from "@/application/ports";
import type { DemoOrderRepository } from "./demo-repositories";

/**
 * Modo demonstração: sem InfinitePay, "pagar no cartão" aprova na hora e volta para a página do pedido,
 * para dar para ver o fluxo inteiro (parte paga, pedido pago) sem cobrar ninguém.
 */
export class DemoPaymentGateway implements PaymentGateway {
  constructor(private readonly orders: DemoOrderRepository) {}

  async cardCheckoutUrl(orderCode: string, paymentId: string): Promise<string> {
    await new Promise((resolve) => setTimeout(resolve, 600));
    this.orders.settlePart(paymentId, "card");
    return `/pedido/${orderCode}`;
  }

  async confirmCardReturn(): Promise<boolean> {
    return true;
  }
}
