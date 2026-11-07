import type { AdminRole } from "./admin-user";

/** Onde está o problema: no painel (sistema) ou na loja (site). */
export const SUPPORT_AREAS = ["system", "site"] as const;
export type SupportArea = (typeof SUPPORT_AREAS)[number];

export const SUPPORT_PRIORITIES = ["low", "normal", "urgent"] as const;
export type SupportPriority = (typeof SUPPORT_PRIORITIES)[number];

export const SUPPORT_STATUSES = ["open", "in_progress", "done"] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export const SUPPORT_AREA_LABEL: Record<SupportArea, string> = { system: "Sistema", site: "Site" };
export const SUPPORT_PRIORITY_LABEL: Record<SupportPriority, string> = { low: "Baixa", normal: "Normal", urgent: "Urgente" };
export const SUPPORT_STATUS_LABEL: Record<SupportStatus, string> = { open: "Aberto", in_progress: "Em andamento", done: "Resolvido" };

export interface SupportAuthor {
  name: string | null;
  role: AdminRole;
}

/** O que a pessoa preenche ao abrir um chamado. */
export interface SupportTicketData {
  title: string;
  description: string;
  area: SupportArea;
  priority: SupportPriority;
}

export interface SupportReply {
  id: string;
  body: string;
  /** Nulo quando o usuário que respondeu foi removido do sistema. */
  author: SupportAuthor | null;
  createdAt: string;
}

export interface SupportTicket extends SupportTicketData {
  id: string;
  status: SupportStatus;
  author: SupportAuthor | null;
  createdAt: string;
  /** Muda a cada resposta ou troca de situação: a lista vem do mais mexido para o menos. */
  updatedAt: string;
  resolvedAt: string | null;
  /** Da mais antiga para a mais nova. */
  replies: SupportReply[];
}

/** Só quem mantém o sistema muda a situação do chamado; os dois abrem e respondem. */
export const canChangeSupportStatus = (role: AdminRole): boolean => role === "developer";

export const isPendingTicket = (ticket: SupportTicket): boolean => ticket.status !== "done";

const PRIORITY_WEIGHT: Record<SupportPriority, number> = { urgent: 0, normal: 1, low: 2 };

/** Pendentes primeiro, urgentes no topo; dentro do mesmo peso, o mais recente antes. */
export function sortTickets(tickets: readonly SupportTicket[]): SupportTicket[] {
  return [...tickets].sort((a, b) => {
    const pending = Number(isPendingTicket(b)) - Number(isPendingTicket(a));
    if (pending !== 0) return pending;
    if (isPendingTicket(a)) {
      const weight = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
      if (weight !== 0) return weight;
    }
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}
