import type { AdminRole } from "./admin-user";

/** Onde está o ajuste: no painel (sistema) ou na loja (site). */
export const SUPPORT_AREAS = ["system", "site"] as const;
export type SupportArea = (typeof SUPPORT_AREAS)[number];

/** O que é: algo quebrado, uma ideia de melhoria ou uma tarefa pendente. */
export const SUPPORT_KINDS = ["problem", "improvement", "task"] as const;
export type SupportKind = (typeof SUPPORT_KINDS)[number];

/** Da mais urgente para a menos urgente: é a ordem dos filtros e da lista. */
export const SUPPORT_PRIORITIES = ["urgent", "normal", "low"] as const;
export type SupportPriority = (typeof SUPPORT_PRIORITIES)[number];

/**
 * Pendente: na fila da Lay. Fazendo agora: o foco dela no momento.
 * Aguardando o Jota: ela precisa que ele analise ou responda. Finalizado: resolvido.
 */
export const SUPPORT_STATUSES = ["open", "in_progress", "waiting", "done"] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export const SUPPORT_AREA_LABEL: Record<SupportArea, string> = { system: "Sistema", site: "Site" };
export const SUPPORT_KIND_LABEL: Record<SupportKind, string> = { problem: "Problema", improvement: "Melhoria", task: "Pendência" };
export const SUPPORT_PRIORITY_LABEL: Record<SupportPriority, string> = { urgent: "Urgente", normal: "Normal", low: "Baixa" };
export const SUPPORT_STATUS_LABEL: Record<SupportStatus, string> = {
  open: "Pendente",
  in_progress: "Fazendo agora",
  waiting: "Aguardando o Jota",
  done: "Finalizado",
};

export interface SupportAuthor {
  name: string | null;
  role: AdminRole;
}

// ---------------------------------------------------------------------------
// Anexos
// ---------------------------------------------------------------------------

export type SupportAttachmentKind = "image" | "video";

export const MAX_ATTACHMENTS_PER_MESSAGE = 5;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
/** Limite do plano gratuito do Supabase por arquivo. */
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const;

export interface SupportAttachment {
  id: string;
  kind: SupportAttachmentKind;
  name: string;
  /** Endereço temporário para ver o arquivo; nulo quando ainda não foi aberto ou expirou. */
  url: string | null;
  /** Nulo quando está no chamado; preenchido quando veio numa resposta. */
  replyId: string | null;
}

/** Arquivo escolhido na tela, antes de subir. */
export interface SupportUpload {
  file: Blob;
  name: string;
  kind: SupportAttachmentKind;
  contentType: string;
}

/** O texto sempre fica salvo; os arquivos que não subiram voltam pelo nome para a tela avisar. */
export interface SupportSubmitResult<T> {
  saved: T;
  failedUploads: string[];
}

export function attachmentKindOf(contentType: string): SupportAttachmentKind | null {
  if ((ACCEPTED_IMAGE_TYPES as readonly string[]).includes(contentType)) return "image";
  if ((ACCEPTED_VIDEO_TYPES as readonly string[]).includes(contentType)) return "video";
  return null;
}

/** Mensagem do problema com o arquivo, ou nulo quando ele pode subir. */
export function attachmentProblem(file: { name: string; type: string; size: number }): string | null {
  const kind = attachmentKindOf(file.type);
  if (!kind) return `"${file.name}" não é imagem (PNG, JPG, WebP, GIF) nem vídeo (MP4, MOV, WebM).`;
  const limit = kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (file.size > limit) return `"${file.name}" passa de ${limit / 1024 / 1024} MB.`;
  return null;
}

// ---------------------------------------------------------------------------
// Chamado e conversa
// ---------------------------------------------------------------------------

/** O que a pessoa preenche ao abrir um chamado. */
export interface SupportTicketData {
  title: string;
  description: string;
  kind: SupportKind;
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
  /** Muda a cada resposta ou troca de situação. */
  updatedAt: string;
  resolvedAt: string | null;
  /** Da mais antiga para a mais nova. */
  replies: SupportReply[];
  attachments: SupportAttachment[];
  /** Etiqueta escolhida pela desenvolvedora; nula quando não tem. */
  labelId: string | null;
  /** Trocas de situação, da mais antiga para a mais nova. */
  events: SupportStatusEvent[];
}

/** Só quem mantém o sistema muda a situação; o banco reabre sozinho quando o Jota responde. */
export const canChangeSupportStatus = (role: AdminRole): boolean => role === "developer";

export const isPendingTicket = (ticket: SupportTicket): boolean => ticket.status !== "done";

/** Quem escreveu por último na conversa (o próprio chamado conta como a primeira mensagem). */
export function lastSpeakerOf(ticket: SupportTicket): AdminRole | null {
  const last = ticket.replies.at(-1);
  return (last ? last.author?.role : ticket.author?.role) ?? null;
}

/**
 * O chamado espera uma ação desta pessoa?
 * Lay: pendente, ou com resposta nova do Jota que ela ainda não respondeu.
 * Jota: aguardando ele analisar ou responder.
 */
export function needsActionFrom(ticket: SupportTicket, role: AdminRole): boolean {
  if (ticket.status === "done") return false;
  if (role === "admin") return ticket.status === "waiting";
  return ticket.status === "open" || lastSpeakerOf(ticket) === "admin";
}

const STATUS_WEIGHT: Record<SupportStatus, number> = { in_progress: 0, open: 1, waiting: 2, done: 3 };
const PRIORITY_WEIGHT: Record<SupportPriority, number> = { urgent: 0, normal: 1, low: 2 };

/** O foco do momento no topo, depois a fila por urgência; finalizados por último. Empate: o mais mexido antes. */
export function sortTickets(tickets: readonly SupportTicket[]): SupportTicket[] {
  return [...tickets].sort(
    (a, b) =>
      STATUS_WEIGHT[a.status] - STATUS_WEIGHT[b.status] ||
      (isPendingTicket(a) ? PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority] : 0) ||
      b.updatedAt.localeCompare(a.updatedAt),
  );
}

// ---------------------------------------------------------------------------
// Etiquetas: a desenvolvedora cria (nome e cor) e escolhe uma por chamado. O Jota só vê.
// ---------------------------------------------------------------------------

export const SUPPORT_LABEL_COLORS = ["electric", "emerald", "amber", "pink", "violet", "red", "gray"] as const;
export type SupportLabelColor = (typeof SUPPORT_LABEL_COLORS)[number];

export const SUPPORT_LABEL_COLOR_NAME: Record<SupportLabelColor, string> = {
  electric: "Azul",
  emerald: "Verde",
  amber: "Amarelo",
  pink: "Rosa",
  violet: "Roxo",
  red: "Vermelho",
  gray: "Cinza",
};

export const SUPPORT_LABEL_NAME_MAX = 30;

export interface SupportLabelData {
  name: string;
  color: SupportLabelColor;
}

export interface SupportLabel extends SupportLabelData {
  id: string;
}

export const canManageSupportLabels = (role: AdminRole): boolean => role === "developer";

/** Apagar um chamado (com conversa e anexos) é só da desenvolvedora. */
export const canDeleteSupportTicket = (role: AdminRole): boolean => role === "developer";

// ---------------------------------------------------------------------------
// Andamento: cada troca de situação fica registrada (quem, de onde, para onde, quando).
// ---------------------------------------------------------------------------

export interface SupportStatusEvent {
  id: string;
  from: SupportStatus | null;
  to: SupportStatus;
  author: SupportAuthor | null;
  createdAt: string;
}

/** Item da linha do tempo do chamado: mensagem ou troca de situação, na ordem em que aconteceram. */
export type SupportTimelineItem =
  | { type: "message"; at: string; reply: SupportReply }
  | { type: "status"; at: string; event: SupportStatusEvent };

export function timelineOf(ticket: Pick<SupportTicket, "replies" | "events">): SupportTimelineItem[] {
  const items: SupportTimelineItem[] = [
    ...ticket.replies.map((reply) => ({ type: "message" as const, at: reply.createdAt, reply })),
    ...ticket.events.map((event) => ({ type: "status" as const, at: event.createdAt, event })),
  ];
  return items.sort((a, b) => a.at.localeCompare(b.at));
}

// ---------------------------------------------------------------------------
// Filtro por período: pela última movimentação do chamado.
// ---------------------------------------------------------------------------

export const SUPPORT_PERIODS = ["all", "today", "7d", "30d", "90d"] as const;
export type SupportPeriod = (typeof SUPPORT_PERIODS)[number];

export const SUPPORT_PERIOD_LABEL: Record<SupportPeriod, string> = {
  all: "Qualquer data",
  today: "Hoje",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
};

const PERIOD_DAYS: Record<Exclude<SupportPeriod, "all" | "today">, number> = { "7d": 7, "30d": 30, "90d": 90 };

export function inPeriod(ticket: Pick<SupportTicket, "updatedAt">, period: SupportPeriod, now: Date = new Date()): boolean {
  if (period === "all") return true;
  const updated = new Date(ticket.updatedAt);
  if (period === "today") return updated.toDateString() === now.toDateString();
  return now.getTime() - updated.getTime() <= PERIOD_DAYS[period] * 24 * 60 * 60 * 1000;
}
