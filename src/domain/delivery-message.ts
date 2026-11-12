/** Mensagem de entrega que o Jota salvou para reaproveitar, além da padrão ("Conta entregue"). */
export interface DeliveryMessage {
  id: string;
  name: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export type DeliveryMessageData = Pick<DeliveryMessage, "name" | "body">;

export const MAX_DELIVERY_MESSAGE_NAME = 40;
export const MAX_SAVED_DELIVERY_MESSAGES = 20;
