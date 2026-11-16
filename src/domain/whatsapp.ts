export { PAYMENT_TEMPLATE, paymentPromptText } from "../../supabase/functions/_shared/whatsapp-delivery";

export type WhatsAppMessageKind = "payment_confirmed" | "delivery";
export type WhatsAppMessageStatus = "queued" | "sending" | "test" | "sent" | "failed";
/** test: só registra no painel; live: envia pela API oficial da Meta. */
export type WhatsAppMode = "test" | "live";

export interface WhatsAppSettings {
  autoDelivery: boolean;
  mode: WhatsAppMode;
}

/** Uma mensagem automática: na fila, registrada em modo teste, enviada ou com falha. Senhas vêm mascaradas. */
export interface WhatsAppMessage {
  id: string;
  kind: WhatsAppMessageKind;
  status: WhatsAppMessageStatus;
  toPhone: string;
  body: string | null;
  error: string | null;
  orderCode: string | null;
  customerName: string | null;
  createdAt: string;
  sentAt: string | null;
}

export const WHATSAPP_KIND_LABEL: Record<WhatsAppMessageKind, string> = {
  payment_confirmed: "Pagamento confirmado",
  delivery: "Acesso da conta",
};

export const WHATSAPP_STATUS_LABEL: Record<WhatsAppMessageStatus, string> = {
  queued: "Na fila",
  sending: "Enviando",
  test: "Teste",
  sent: "Enviada",
  failed: "Falhou",
};

export const DEFAULT_WHATSAPP_SETTINGS: WhatsAppSettings = { autoDelivery: true, mode: "test" };
