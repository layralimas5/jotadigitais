import type { AiSchedule } from "../../supabase/functions/_shared/whatsapp-schedule";
export {
  MASKED_SECRET,
  PAYMENT_TEMPLATE,
  WRONG_PHONE_REPLY,
  accessCodeOf,
  accessRequestText,
  afterSaleText,
  paymentPromptText,
  reminderText,
  samePhone,
} from "../../supabase/functions/_shared/whatsapp-delivery";

export type WhatsAppMessageKind = "payment_confirmed" | "delivery" | "payment_reminder" | "after_sale";
export type WhatsAppMessageStatus = "queued" | "sending" | "test" | "sent" | "failed" | "canceled";
/** test: só registra no painel; live: envia pela API oficial da Meta. */
export type WhatsAppMode = "test" | "live";

/** Lembrete de pedido não pago e pós-venda: ligados pelo Jota, disparados pelo agendador do banco. */
export interface WhatsAppFollowUps {
  paymentReminder: boolean;
  /** Minutos antes de a reserva vencer. */
  reminderMinutes: number;
  afterSale: boolean;
  /** Dias depois da entrega. */
  afterSaleDays: number;
}

export interface WhatsAppSettings {
  autoDelivery: boolean;
  mode: WhatsAppMode;
  followUps: WhatsAppFollowUps;
}

/** Limites da migration 20261219120000_whatsapp_followups; com a reserva de 10 minutos, o lembrete sai na metade. */
export const REMINDER_MINUTE_OPTIONS = [5] as const;
export const AFTER_SALE_DAY_OPTIONS = [1, 2, 3, 5, 7, 15] as const;

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
  payment_reminder: "Lembrete de pagamento",
  after_sale: "Pós-venda",
};

export const WHATSAPP_STATUS_LABEL: Record<WhatsAppMessageStatus, string> = {
  queued: "Na fila",
  sending: "Enviando",
  test: "Teste",
  sent: "Enviada",
  failed: "Falhou",
  canceled: "Não saiu",
};

// ---------------------------------------------------------------------------
// Relatório (aba WhatsApp > Relatório)
// ---------------------------------------------------------------------------

export const REPORT_PERIODS = [7, 30, 90] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

/** Números de um período. Envios do modo teste contam junto. */
export interface WhatsAppReport {
  days: ReportPeriod;
  /** Conversas em que o cliente escreveu no período. */
  conversations: number;
  newContacts: number;
  received: number;
  aiReplies: number;
  staffReplies: number;
  /** Conversas do período resolvidas sem o Jota escrever nada. */
  aiOnly: number;
  /** Vezes que a IA passou a conversa para o Jota. */
  handoffs: number;
  waitingNow: number;
  accessDelivered: number;
  remindersSent: number;
  /** Lembretes cujo pedido acabou pago. */
  remindersPaid: number;
  afterSalesSent: number;
  /** Pedidos pagos de quem já tinha conversado no WhatsApp antes de comprar. */
  chatSales: number;
  chatSalesCents: number;
}

/** Parte de um total em porcentagem inteira; zero quando não há total. */
export const shareOf = (part: number, total: number): number => (total > 0 ? Math.round((part / total) * 100) : 0);

export const DEFAULT_FOLLOW_UPS: WhatsAppFollowUps = { paymentReminder: false, reminderMinutes: 5, afterSale: false, afterSaleDays: 3 };

export const DEFAULT_WHATSAPP_SETTINGS: WhatsAppSettings = { autoDelivery: true, mode: "test", followUps: DEFAULT_FOLLOW_UPS };

// ---------------------------------------------------------------------------
// Atendimento com IA e conversas (abas WhatsApp e Automação > IA)
// ---------------------------------------------------------------------------

export {
  STORE_TIME_ZONE,
  aiAnswersAt,
  isBusinessHours,
  type AiSchedule,
  type BusinessHours,
} from "../../supabase/functions/_shared/whatsapp-schedule";

/** O que o Jota configura na aba Automação > IA. Mesmos limites das colunas de whatsapp_settings. */
export interface WhatsAppAiSettings {
  enabled: boolean;
  greeting: string;
  tone: string;
  instructions: string;
  schedule: AiSchedule;
  /** "HH:MM", hora de Brasília. */
  businessStart: string;
  businessEnd: string;
  /** 0 = domingo ... 6 = sábado. */
  businessDays: number[];
  /** Números (só dígitos, com DDI) que a IA não responde: família, fornecedor, o próprio Jota. */
  ignoredNumbers: string[];
}

export const AI_LIMITS = { greeting: 1000, tone: 600, instructions: 4000, question: 300, answer: 2000, faq: 100 } as const;

export const DEFAULT_AI_SETTINGS: WhatsAppAiSettings = {
  enabled: false,
  greeting: "Oi! Aqui é o atendimento da Jota Digitais. Me conta o que você procura que eu te mostro as contas disponíveis.",
  tone: "Simpático, direto e confiante, como o Jota falando com um cliente. Frases curtas, sem formalidade, sem gíria pesada.",
  instructions: "",
  schedule: "always",
  businessStart: "09:00",
  businessEnd: "18:00",
  businessDays: [1, 2, 3, 4, 5, 6],
  ignoredNumbers: [],
};

export interface WhatsAppFaq {
  id: string;
  question: string;
  answer: string;
}

export type WhatsAppFaqDraft = Omit<WhatsAppFaq, "id"> & { id?: string };

export const WEEKDAYS: readonly { value: number; short: string }[] = [
  { value: 0, short: "Dom" },
  { value: 1, short: "Seg" },
  { value: 2, short: "Ter" },
  { value: 3, short: "Qua" },
  { value: 4, short: "Qui" },
  { value: 5, short: "Sex" },
  { value: 6, short: "Sáb" },
];

export const CONTACT_KINDS = ["lead", "customer", "affiliate", "student"] as const;
export type WhatsAppContactKind = (typeof CONTACT_KINDS)[number];

export const CONTACT_KIND_LABEL: Record<WhatsAppContactKind, string> = {
  lead: "Interessado",
  customer: "Cliente",
  affiliate: "Afiliado",
  student: "Aluno",
};

/** Quem responde a conversa agora. */
export type WhatsAppHandler = "ai" | "staff";

export interface WhatsAppContact {
  id: string;
  phone: string;
  name: string | null;
  kind: WhatsAppContactKind;
  handler: WhatsAppHandler;
  optedOut: boolean;
  handoffSummary: string | null;
  unreadCount: number;
  lastInboundAt: string | null;
  lastMessageAt: string;
  lastMessagePreview: string | null;
}

export type ChatAuthor = "customer" | "ai" | "staff" | "system";
export type ChatStatus = "received" | "test" | "sent" | "failed";

export interface WhatsAppChatMessage {
  id: string;
  author: ChatAuthor;
  body: string;
  status: ChatStatus;
  error: string | null;
  createdAt: string;
}

export const CHAT_AUTHOR_LABEL: Record<ChatAuthor, string> = {
  customer: "Cliente",
  ai: "IA",
  staff: "Você",
  system: "Automático",
};

/** Conversa esperando o Jota: está com ele e tem mensagem sem resposta. */
export const needsStaff = (contact: Pick<WhatsAppContact, "handler" | "unreadCount">) =>
  contact.handler === "staff" && contact.unreadCount > 0;

/** Janela de 24h da Meta: depois disso, só modelo aprovado puxa conversa. */
export const WINDOW_MS = 24 * 60 * 60 * 1000;

export const windowOpen = (contact: Pick<WhatsAppContact, "lastInboundAt">, now = Date.now()) =>
  contact.lastInboundAt !== null && now - new Date(contact.lastInboundAt).getTime() < WINDOW_MS;

/** Uma volta do simulador: a fala e o que a IA fez (consultou contas, passou para o Jota). */
export interface SimulatorTurn {
  role: "user" | "assistant";
  text: string;
}

export interface SimulatorReply {
  reply: string | null;
  handoff: { reason: string; summary: string } | null;
  toolsUsed: string[];
  /** Botões que a resposta levaria no WhatsApp (pergunta de fluxo). */
  options: string[];
}

/** Teste de um fluxo da tela (mesmo sem salvar), como um contato de certo tipo, dentro ou fora do horário. */
export interface FlowTestDraft {
  flow: { id?: string; name: string; graph: unknown };
  contactKind: WhatsAppContactKind;
  businessHours: boolean;
}

/** Rascunho da tela de IA que o simulador usa antes de salvar. */
export interface AiDraft {
  greeting: string;
  tone: string;
  instructions: string;
  faq: readonly { question: string; answer: string }[];
}

export type InboundOutcome =
  | "duplicate"
  | "ignored"
  | "opted_out"
  | "staff"
  | "ai_off"
  | "replied"
  | "handoff"
  | "access_delivered"
  | "access_wrong_phone"
  | "access_failed";
