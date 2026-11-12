import { siteConfig } from "@/app/config";
import { EMPTY_DELIVERY_LOGIN, type DeliveryLogin } from "@/domain/delivery-login";
import { fillDeliveryTemplate, fillTemplate, type MessageTemplateKey, type MessageTemplates } from "@/domain/message-template";
import { formatBRL } from "@/domain/money";
import type { Order, OrderStatus } from "@/domain/order";
import { PLATFORM_LABEL } from "@/domain/platform";
import { firstNameOf } from "./whatsapp";

const ORDER_TEMPLATE: Record<OrderStatus, MessageTemplateKey> = {
  awaiting_payment: "order_received",
  paid: "payment_confirmed",
  delivered: "order_delivered",
  canceled: "customer_hello",
};

/** Mensagem do WhatsApp para o pedido, conforme a etapa em que ele está. A de entrega leva o login da conta. */
export function orderMessage(templates: MessageTemplates, order: Order, login: DeliveryLogin = EMPTY_DELIVERY_LOGIN): string {
  const key = ORDER_TEMPLATE[order.status];
  if (key === "order_delivered") return deliveryMessage(templates.order_delivered, order, login);
  return fillTemplate(templates[key], orderValuesOf(order));
}

/**
 * Orientações para quem comprou a conta: pago ou entregue já recebe o modelo "Conta entregue"
 * (com o e-mail e a senha); reservado ainda sem pagamento recebe "Pedido recebido".
 */
export function buyerMessage(templates: MessageTemplates, order: Order, login: DeliveryLogin = EMPTY_DELIVERY_LOGIN): string {
  if (order.status === "awaiting_payment") return fillTemplate(templates.order_received, orderValuesOf(order));
  return deliveryMessage(templates.order_delivered, order, login);
}

/** Mensagem de entrega (a padrão ou uma salva) com o e-mail e o login do perfil, para mandar depois do pagamento. */
export function deliveryMessage(body: string, order: Order, login: DeliveryLogin): string {
  return fillDeliveryTemplate(body, orderValuesOf(order), login);
}

const orderValuesOf = (order: Order) => ({
  nome: firstNameOf(order.customer.name),
  pedido: order.code,
  conta: order.accountHandle,
  valor: formatBRL(order.total),
  rede: PLATFORM_LABEL[order.accountPlatform],
  loja: siteConfig.name,
});

/** Mensagem para uma pessoa (lead do CRM ou cliente), sem dados de pedido. */
export function personMessage(templates: MessageTemplates, key: "crm_follow_up" | "customer_hello", name: string): string {
  return fillTemplate(templates[key], { nome: firstNameOf(name), loja: siteConfig.name });
}
