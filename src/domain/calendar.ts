import type { Lead } from "./lead";
import { LEAD_STAGE_LABEL } from "./lead";
import { formatBRL } from "./money";
import { PLATFORM_LABEL } from "./platform";

/** Conta Google ligada ao sistema. Guardada nas preferências do painel; a senha nunca passa pelo sistema. */
export interface CalendarConnection {
  email: string;
  connectedAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  /** AAAA-MM-DD para compromisso de dia inteiro, data e hora completa para os outros. */
  start: string;
  allDay: boolean;
  link: string | null;
}

/** Compromisso que o sistema cria. `key` evita duplicar: o mesmo retorno atualiza o compromisso que já existe. */
export interface CalendarEventDraft {
  key: string;
  title: string;
  description: string;
  /** AAAA-MM-DD, dia inteiro. */
  date: string;
}

export type UpsertResult = "created" | "updated";

export interface SyncSummary {
  created: number;
  updated: number;
}

export const CALENDAR_ERRORS = ["not_configured", "popup_closed", "denied", "expired", "failed"] as const;
export type CalendarErrorCode = (typeof CALENDAR_ERRORS)[number];

const MESSAGE: Record<CalendarErrorCode, string> = {
  not_configured: "O Google Agenda ainda não foi ativado neste sistema. Peça para quem cuida do sistema fazer a preparação.",
  popup_closed: "A janela do Google foi fechada antes de terminar. Clique em Conectar e escolha sua conta.",
  denied: "O Google não liberou o acesso. Clique em Conectar de novo e marque a permissão da agenda.",
  expired: "Por segurança, o Google pede para abrir a agenda de novo a cada visita. Clique em Abrir agenda.",
  failed: "Não foi possível falar com o Google agora. Tente de novo em instantes.",
};

export class CalendarError extends Error {
  readonly code: CalendarErrorCode;

  constructor(code: CalendarErrorCode) {
    super(MESSAGE[code]);
    this.name = "CalendarError";
    this.code = code;
  }
}

/** Um retorno do CRM vira um compromisso de dia inteiro, com o que o Jota precisa para chamar a pessoa. */
export function followUpEventOf(lead: Lead & { nextFollowUp: string }): CalendarEventDraft {
  const lines = [
    `Etapa: ${LEAD_STAGE_LABEL[lead.stage]}`,
    lead.interest ? `Procura: conta de ${PLATFORM_LABEL[lead.interest]}` : null,
    lead.budget !== null ? `Orçamento: ${formatBRL(lead.budget)}` : null,
    lead.whatsapp ? `WhatsApp: https://wa.me/${lead.whatsapp.startsWith("55") ? lead.whatsapp : `55${lead.whatsapp}`}` : null,
    lead.instagram ? `Instagram: ${lead.instagram}` : null,
    lead.notes ? `\nAnotações: ${lead.notes}` : null,
  ].filter((line): line is string => line !== null);
  return {
    key: `lead:${lead.id}`,
    title: `Retorno: ${lead.name}`,
    description: lines.join("\n"),
    date: lead.nextFollowUp,
  };
}
