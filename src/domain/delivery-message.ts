import type { DescriptionKind } from "./account-description";

/** Mensagem de entrega que o Jota salvou para reaproveitar, além da padrão ("Conta entregue"). */
export interface DeliveryMessage {
  id: string;
  name: string;
  body: string;
  /** Tipo de conta em que esta mensagem já abre selecionada (uma por tipo). Nulo: só quando o Jota escolhe. */
  accountKind: DescriptionKind | null;
  createdAt: string;
  updatedAt: string;
}

export type DeliveryMessageData = Pick<DeliveryMessage, "name" | "body" | "accountKind">;

export const MAX_DELIVERY_MESSAGE_NAME = 40;
export const MAX_SAVED_DELIVERY_MESSAGES = 20;
