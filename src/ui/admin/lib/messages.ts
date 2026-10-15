import { siteConfig } from "@/app/config";
import { fillTemplate, type MessageTemplateKey, type MessageTemplates } from "@/domain/message-template";
import { formatBRL } from "@/domain/money";
import type { Order, OrderStatus } from "@/domain/order";
import { firstNameOf } from "./whatsapp";

const ORDER_TEMPLATE: Record<OrderStatus, MessageTemplateKey> = {
  awaiting_payment: "order_received",
  paid: "payment_confirmed",
  delivered: "order_delivered",
  canceled: "customer_hello",
};

/** Mensagem do WhatsApp para o pedido, conforme a etapa em que ele está. */
export function orderMessage(templates: MessageTemplates, order: Order): string {
  return fillTemplate(templates[ORDER_TEMPLATE[order.status]], {
    nome: firstNameOf(order.customer.name),
    pedido: order.code,
    conta: order.accountHandle,
    valor: formatBRL(order.total),
    loja: siteConfig.name,
  });
}

/** Mensagem para uma pessoa (lead do CRM ou cliente), sem dados de pedido. */
export function personMessage(templates: MessageTemplates, key: "crm_follow_up" | "customer_hello", name: string): string {
  return fillTemplate(templates[key], { nome: firstNameOf(name), loja: siteConfig.name });
}
