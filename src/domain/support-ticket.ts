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
  avatarUrl: string | null;
}

// ---------------------------------------------------------------------------
// Anexos
// ---------------------------------------------------------------------------

export type SupportAttachmentKind = "image" | "video" | "audio";

export const MAX_ATTACHMENTS_PER_MESSAGE = 5;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
/** Limite do plano gratuito do Supabase por arquivo. */
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const;
/** Gravado no navegador (WebM no Chrome, MP4 no Safari) ou áudio salvo do WhatsApp (OGG/Opus). */
export const ACCEPTED_AUDIO_TYPES = [
  "audio/webm",
  "audio/ogg",
  "audio/opus",
  "audio/mpeg",
  "audio/mp4",
  "audio/aac",
  "audio/x-m4a",
  "audio/wav",
] as const;
export const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

/** "audio/webm;codecs=opus" vira "audio/webm": o banco e o armazenamento guardam o tipo sem os parâmetros. */
export const baseContentType = (contentType: string): string => contentType.split(";")[0]?.trim().toLowerCase() ?? "";

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
  const type = baseContentType(contentType);
  if ((ACCEPTED_IMAGE_TYPES as readonly string[]).includes(type)) return "image";
  if ((ACCEPTED_VIDEO_TYPES as readonly string[]).includes(type)) return "video";
  if ((ACCEPTED_AUDIO_TYPES as readonly string[]).includes(type)) return "audio";
  return null;
}

const SIZE_LIMIT: Record<SupportAttachmentKind, number> = { image: MAX_IMAGE_BYTES, video: MAX_VIDEO_BYTES, audio: MAX_AUDIO_BYTES };

/** Extensões de áudio que o navegador às vezes entrega sem tipo (ex.: .opus do WhatsApp no Windows). */
const AUDIO_TYPE_BY_EXTENSION: Record<string, string> = {
  opus: "audio/ogg",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  aac: "audio/aac",
  wav: "audio/wav",
  weba: "audio/webm",
};

/** Tipo do arquivo, deduzido pela extensão quando o navegador não informa. */
export function contentTypeOf(file: { name: string; type: string }): string {
  const type = baseContentType(file.type);
  if (type && type !== "application/octet-stream") return type;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return AUDIO_TYPE_BY_EXTENSION[extension] ?? type;
}

/** Texto que vai na mensagem quando a pessoa manda só o áudio, sem escrever nada. */
export const VOICE_MESSAGE_TEXT = "Mensagem de voz";

/** Mensagem do problema com o arquivo, ou nulo quando ele pode subir. */
export function attachmentProblem(file: { name: string; type: string; size: number }): string | null {
  const kind = attachmentKindOf(file.type);
  if (!kind) return `"${file.name}" não é imagem (PNG, JPG, WebP, GIF), vídeo (MP4, MOV, WebM) nem áudio (MP3, OGG, M4A, WebM).`;
  const limit = SIZE_LIMIT[kind];
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
  /** Só a desenvolvedora vê: tarefa dela, fora do painel do Jota. Quem abre como Jota sempre grava falso. */
  internal: boolean;
}

/** Id da mensagem que abriu o chamado, para citá-la numa resposta: ela não é uma resposta, mora no próprio chamado. */
export const SUPPORT_OPENING_ID = "opening";

export interface SupportReply {
  id: string;
  body: string;
  /** Nulo quando o usuário que respondeu foi removido do sistema. */
  author: SupportAuthor | null;
  createdAt: string;
  /** Mensagem respondida: id de outra resposta, `SUPPORT_OPENING_ID` para a abertura, nulo quando não cita nenhuma. */
  replyToId: string | null;
}

/** Mensagem citada numa resposta, como aparece no chat. Nula quando a original foi apagada. */
export interface SupportQuote {
  id: string;
  author: SupportAuthor | null;
  body: string;
}

export function quotedMessageOf(ticket: Pick<SupportTicket, "author" | "description" | "replies">, replyToId: string | null): SupportQuote | null {
  if (!replyToId) return null;
  if (replyToId === SUPPORT_OPENING_ID) return { id: SUPPORT_OPENING_ID, author: ticket.author, body: ticket.description };
  const reply = ticket.replies.find((item) => item.id === replyToId);
  return reply ? { id: reply.id, author: reply.author, body: reply.body } : null;
}

export const isQuotableIn = (ticket: Pick<SupportTicket, "replies">, replyToId: string): boolean =>
  replyToId === SUPPORT_OPENING_ID || ticket.replies.some((item) => item.id === replyToId);

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
  /** Última vez que cada pessoa abriu o chamado. */
  views: SupportView[];
  /** Chamado principal quando este foi juntado a ele; nulo nos chamados soltos. */
  mergedInto: string | null;
  mergedAt: string | null;
  /** Chamados juntados neste, do mais antigo para o mais novo. Vazio nos que não têm nenhum. */
  merged: SupportTicket[];
  /** Itens do pedido, na ordem que a desenvolvedora montou. Vazio quando o chamado não tem checklist. */
  checklist: SupportChecklistItem[];
  /** Previsão de entrega (AAAA-MM-DD); nula quando não foi combinada. */
  dueDate: string | null;
  /** Quando a desenvolvedora marcou que o ajuste já está no ar. */
  releasedAt: string | null;
}

// ---------------------------------------------------------------------------
// Checklist, previsão e publicação
// ---------------------------------------------------------------------------

export interface SupportChecklistItem {
  id: string;
  body: string;
  done: boolean;
  position: number;
  doneAt: string | null;
}

export const MAX_CHECKLIST_ITEM_LENGTH = 200;

export interface ChecklistProgress {
  done: number;
  total: number;
}

export const checklistProgressOf = (ticket: Pick<SupportTicket, "checklist">): ChecklistProgress => ({
  done: ticket.checklist.filter((item) => item.done).length,
  total: ticket.checklist.length,
});

export const sortChecklist = (items: readonly SupportChecklistItem[]): SupportChecklistItem[] =>
  [...items].sort((a, b) => a.position - b.position);

/**
 * "Uma linha, um item": cola o pedido do Jota e cada linha vira um item.
 * Marcadores do começo ("-", "•", "1.", "1)") saem; linhas vazias e repetidas, também.
 */
export function checklistItemsFromText(text: string): string[] {
  const seen = new Set<string>();
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim().slice(0, MAX_CHECKLIST_ITEM_LENGTH))
    .filter((line) => {
      const key = line.toLocaleLowerCase("pt-BR");
      if (!line || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** Previsão vencida: passou do dia e o ajuste ainda não foi publicado nem finalizado. */
export function isOverdue(ticket: Pick<SupportTicket, "dueDate" | "releasedAt" | "status">, today: string): boolean {
  return ticket.dueDate !== null && ticket.releasedAt === null && ticket.status !== "done" && ticket.dueDate < today;
}

/** O suporte é só entre o Jota e a desenvolvedora: ajudante não abre a aba. */
export type SupportRole = Extract<AdminRole, "admin" | "developer">;
export const supportRoleOf = (role: AdminRole): SupportRole => (role === "developer" ? "developer" : "admin");

/** Jota e a desenvolvedora mudam a prioridade de um chamado em aberto, quem quer que o tenha aberto. */
export const canChangeSupportPriority = (ticket: Pick<SupportTicket, "status">, role: AdminRole): boolean =>
  (role === "admin" || role === "developer") && ticket.status !== "done";

export interface SupportView {
  role: AdminRole;
  seenAt: string;
}

/** Chamado interno é da desenvolvedora: não aparece para o Jota (nem no "ver como o Jota"). */
export const isVisibleTo = (ticket: Pick<SupportTicket, "internal">, role: AdminRole): boolean => !ticket.internal || role === "developer";

/** Situações possíveis do chamado: o interno não fica aguardando o Jota, porque ele não vê. */
export const statusesFor = (ticket: Pick<SupportTicket, "internal">): readonly SupportStatus[] =>
  ticket.internal ? SUPPORT_STATUSES.filter((status) => status !== "waiting") : SUPPORT_STATUSES;

/** Só a desenvolvedora decide se o chamado fica só com ela ou se o Jota também vê. */
export const canChangeSupportVisibility = (role: AdminRole): boolean => role === "developer";

/** Só quem mantém o sistema muda a situação; o banco reabre sozinho quando o Jota responde. */
export const canChangeSupportStatus = (role: AdminRole): boolean => role === "developer";

/** O Jota aprova e finaliza o que está esperando por ele. */
export const canApproveSupportTicket = (ticket: Pick<SupportTicket, "status">, role: AdminRole): boolean =>
  role === "admin" && ticket.status === "waiting";

/** Finalizado pelo próprio Jota, aprovando o que estava esperando por ele. */
export function wasApprovedByAdmin(ticket: Pick<SupportTicket, "status" | "events">): boolean {
  if (ticket.status !== "done") return false;
  const last = ticket.events.at(-1);
  return last?.to === "done" && last.author?.role === "admin";
}

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

/**
 * Ordem da lista: o que espera o Jota (análise ou aprovação) primeiro, depois o que a Lay está
 * fazendo, depois a fila dela; finalizados por último.
 */
export const SUPPORT_STATUS_ORDER: readonly SupportStatus[] = ["waiting", "in_progress", "open", "done"];

const PRIORITY_WEIGHT: Record<SupportPriority, number> = { urgent: 0, normal: 1, low: 2 };
const statusWeight = (status: SupportStatus): number => SUPPORT_STATUS_ORDER.indexOf(status);

/** Por situação (SUPPORT_STATUS_ORDER), dentro dela por urgência. Empate: o mais mexido antes. */
export function sortTickets(tickets: readonly SupportTicket[]): SupportTicket[] {
  return [...tickets].sort(
    (a, b) =>
      statusWeight(a.status) - statusWeight(b.status) ||
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

/** Juntar chamados parecidos num só (e separar de novo) é só da desenvolvedora. */
export const canMergeSupportTickets = (role: AdminRole): boolean => role === "developer";

export const isMergedTicket = (ticket: Pick<SupportTicket, "mergedInto">): boolean => ticket.mergedInto !== null;

/**
 * Lista com os juntados dentro do principal. Juntado cujo principal não aparece para quem vê (não deveria acontecer:
 * o banco abre o principal para o Jota) volta a aparecer solto, para nada sumir.
 */
export function nestMergedTickets(tickets: readonly SupportTicket[]): SupportTicket[] {
  const ids = new Set(tickets.map((ticket) => ticket.id));
  const isChild = (ticket: SupportTicket) => ticket.mergedInto !== null && ids.has(ticket.mergedInto);
  const byOldest = (a: SupportTicket, b: SupportTicket) => a.createdAt.localeCompare(b.createdAt);
  return tickets
    .filter((ticket) => !isChild(ticket))
    .map((ticket) => ({ ...ticket, merged: tickets.filter((child) => isChild(child) && child.mergedInto === ticket.id).sort(byOldest) }));
}

/** Principal sugerido ao juntar: o mais antigo, que normalmente tem a conversa mais longa. */
export const suggestedMergeTarget = (tickets: readonly SupportTicket[]): SupportTicket | null =>
  [...tickets].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0] ?? null;

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
// Filtro por última movimentação do chamado (resposta ou troca de situação).
// ---------------------------------------------------------------------------

export const SUPPORT_PERIODS = ["all", "today", "7d", "30d", "90d"] as const;
export type SupportPeriod = (typeof SUPPORT_PERIODS)[number];

export const SUPPORT_PERIOD_LABEL: Record<SupportPeriod, string> = {
  all: "Mexido em qualquer data",
  today: "Mexido hoje",
  "7d": "Mexido nos últimos 7 dias",
  "30d": "Mexido nos últimos 30 dias",
  "90d": "Mexido nos últimos 90 dias",
};

const PERIOD_DAYS: Record<Exclude<SupportPeriod, "all" | "today">, number> = { "7d": 7, "30d": 30, "90d": 90 };

export function inPeriod(ticket: Pick<SupportTicket, "updatedAt">, period: SupportPeriod, now: Date = new Date()): boolean {
  if (period === "all") return true;
  const updated = new Date(ticket.updatedAt);
  if (period === "today") return updated.toDateString() === now.toDateString();
  return now.getTime() - updated.getTime() <= PERIOD_DAYS[period] * 24 * 60 * 60 * 1000;
}

// ---------------------------------------------------------------------------
// Tempo na fila: contado desde a abertura do chamado, para atacar primeiro o que espera há mais tempo.
// ---------------------------------------------------------------------------

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const SUPPORT_AGES = ["all", "1d", "over3d", "over7d", "over30d"] as const;
export type SupportAge = (typeof SUPPORT_AGES)[number];

export const SUPPORT_AGE_LABEL: Record<SupportAge, string> = {
  all: "Qualquer tempo na fila",
  "1d": "Abertos nas últimas 24 h",
  over3d: "Há mais de 3 dias",
  over7d: "Há mais de 7 dias",
  over30d: "Há mais de 30 dias",
};

/** Quanto tempo o chamado ficou (ou está) aberto: até agora, ou até ser finalizado. */
export function queueTimeMs(ticket: Pick<SupportTicket, "createdAt" | "resolvedAt" | "status">, now: Date = new Date()): number {
  const end = ticket.status === "done" && ticket.resolvedAt ? new Date(ticket.resolvedAt) : now;
  return Math.max(0, end.getTime() - new Date(ticket.createdAt).getTime());
}

const AGE_TEST: Record<SupportAge, (ms: number) => boolean> = {
  all: () => true,
  "1d": (ms) => ms <= DAY_MS,
  over3d: (ms) => ms > 3 * DAY_MS,
  over7d: (ms) => ms > 7 * DAY_MS,
  over30d: (ms) => ms > 30 * DAY_MS,
};

export const matchesAge = (ticket: Pick<SupportTicket, "createdAt" | "resolvedAt" | "status">, age: SupportAge, now: Date = new Date()): boolean =>
  AGE_TEST[age](queueTimeMs(ticket, now));

/** Cor do tempo: até 2 dias está em dia, até 7 pede atenção, depois disso está atrasado. */
export type QueueAgeTone = "fresh" | "aging" | "late";

export function queueAgeTone(ms: number): QueueAgeTone {
  if (ms < 2 * DAY_MS) return "fresh";
  if (ms < 7 * DAY_MS) return "aging";
  return "late";
}

/** "menos de 1 h", "5 h", "1 dia", "12 dias". */
export function formatQueueTime(ms: number): string {
  if (ms < HOUR_MS) return "menos de 1 h";
  if (ms < DAY_MS) return `${Math.floor(ms / HOUR_MS)} h`;
  const days = Math.floor(ms / DAY_MS);
  return days === 1 ? "1 dia" : `${days} dias`;
}

export const SUPPORT_SORTS = ["priority", "stale", "oldest", "newest"] as const;
export type SupportSort = (typeof SUPPORT_SORTS)[number];

export const SUPPORT_SORT_LABEL: Record<SupportSort, string> = {
  priority: "Mais urgentes primeiro",
  stale: "Parados há mais tempo",
  oldest: "Há mais tempo na fila",
  newest: "Abertos mais recentes",
};

/** Mantém a separação por situação; dentro dela, ordena pela urgência (padrão) ou pela data de abertura. */
export function orderTickets(tickets: readonly SupportTicket[], sort: SupportSort): SupportTicket[] {
  if (sort === "priority") return sortTickets(tickets);
  if (sort === "stale") {
    return [...tickets].sort((a, b) => statusWeight(a.status) - statusWeight(b.status) || lastActivityAt(a).localeCompare(lastActivityAt(b)));
  }
  const byAge = (a: SupportTicket, b: SupportTicket) =>
    sort === "oldest" ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt);
  return [...tickets].sort((a, b) => statusWeight(a.status) - statusWeight(b.status) || byAge(a, b));
}

// ---------------------------------------------------------------------------
// Visto: cada pessoa vê se o outro lado já abriu o chamado depois da mensagem dela.
// ---------------------------------------------------------------------------

/** Com quem a pessoa conversa no suporte: a Lay com o Jota e o Jota com a Lay. */
export const counterpartOf = (role: SupportRole): SupportRole => (role === "developer" ? "admin" : "developer");

export const SUPPORT_ROLE_NAME: Record<SupportRole, string> = { developer: "Layra", admin: "Jota" };

/** Última vez que alguém com esse papel abriu o chamado; nulo quando nunca abriu. */
export function seenAtBy(ticket: Pick<SupportTicket, "views">, role: AdminRole): string | null {
  const dates = ticket.views.filter((view) => view.role === role).map((view) => view.seenAt);
  return dates.length ? dates.reduce((latest, date) => (Date.parse(date) > Date.parse(latest) ? date : latest)) : null;
}

/** A mensagem enviada em `sentAt` já foi vista por quem tem esse papel? */
export function wasSeenBy(ticket: Pick<SupportTicket, "views">, role: AdminRole, sentAt: string): boolean {
  const seenAt = seenAtBy(ticket, role);
  return seenAt !== null && Date.parse(seenAt) >= Date.parse(sentAt);
}

/** O que vira aviso no sininho do Jota quando a Lay escolhe avisar. */
export type SupportNotifyEvent = "opened" | "replied";

/** Só a Lay avisa o Jota, e só em chamado que ele vê. */
export const canNotifyAdmin = (ticket: Pick<SupportTicket, "internal">, role: AdminRole): boolean => role === "developer" && !ticket.internal;

/** Hora da última mensagem desta pessoa (o próprio chamado conta como a primeira); nula se ela não escreveu. */
export function lastMessageAtFrom(ticket: Pick<SupportTicket, "author" | "createdAt" | "replies">, role: AdminRole): string | null {
  const replies = ticket.replies.filter((reply) => reply.author?.role === role);
  const last = replies.at(-1);
  if (last) return last.createdAt;
  return ticket.author?.role === role ? ticket.createdAt : null;
}

/** Tem coisa da outra pessoa que quem está vendo ainda não abriu? */
export function hasUnseenFrom(ticket: SupportTicket, viewer: SupportRole): boolean {
  const theirs = lastMessageAtFrom(ticket, counterpartOf(viewer));
  return theirs !== null && !wasSeenBy(ticket, viewer, theirs);
}

// ---------------------------------------------------------------------------
// Respostas prontas (só a desenvolvedora)
// ---------------------------------------------------------------------------

export interface SupportCannedReplyData {
  title: string;
  body: string;
}

export interface SupportCannedReply extends SupportCannedReplyData {
  id: string;
}

export const MAX_CANNED_TITLE_LENGTH = 60;
export const MAX_CANNED_BODY_LENGTH = 2000;

/** As três que a Lay pediu; o banco já nasce com elas (o modo demo também). */
export const DEFAULT_CANNED_REPLIES: readonly SupportCannedReplyData[] = [
  { title: "Publicado", body: 'Publicado! Confere aí e, se estiver tudo certo, é só clicar em "Aprovado e finalizado".' },
  { title: "Preciso de um print", body: "Consegue me mandar um print da tela onde aconteceu? Se puder, mostra também o que você clicou antes." },
  { title: "Depende do contador", body: "Essa parte depende do contador. Assim que você tiver a resposta dele, me manda aqui que eu sigo." },
];

// ---------------------------------------------------------------------------
// Parado e reabrir
// ---------------------------------------------------------------------------

/** Sem resposta nem troca de situação há tantos dias, o chamado ganha o selo "Parado". */
export const STALE_AFTER_DAYS = 3;
/** Depois de tantos dias parado, o selo fica vermelho. */
export const STALE_LATE_DAYS = 7;
/** Por quantos dias depois de finalizado o Jota ainda reabre o mesmo chamado. */
export const REOPEN_WINDOW_DAYS = 7;

/** Último movimento do chamado: a abertura, a última resposta ou a última troca de situação. */
export function lastActivityAt(ticket: Pick<SupportTicket, "createdAt" | "replies" | "events">): string {
  return [ticket.createdAt, ...ticket.replies.map((reply) => reply.createdAt), ...ticket.events.map((event) => event.createdAt)].reduce((latest, at) =>
    at > latest ? at : latest,
  );
}

/**
 * Dias inteiros sem movimento num chamado em aberto que já teve conversa; nulo quando finalizado, dentro do prazo
 * ou nunca mexido (aí o "Aberto há X" já diz o mesmo).
 */
export function staleDaysOf(ticket: Pick<SupportTicket, "createdAt" | "replies" | "events" | "status">, now: Date = new Date()): number | null {
  if (ticket.status === "done") return null;
  const last = lastActivityAt(ticket);
  if (last === ticket.createdAt) return null;
  const days = Math.floor((now.getTime() - new Date(last).getTime()) / DAY_MS);
  return days >= STALE_AFTER_DAYS ? days : null;
}

/** Até quando o chamado finalizado ainda pode ser reaberto; nulo quando não está finalizado. */
export function reopenDeadlineOf(ticket: Pick<SupportTicket, "status" | "resolvedAt">): Date | null {
  if (ticket.status !== "done" || !ticket.resolvedAt) return null;
  return new Date(new Date(ticket.resolvedAt).getTime() + REOPEN_WINDOW_DAYS * DAY_MS);
}

/** O Jota reabre um chamado compartilhado finalizado há até 7 dias (o banco confere de novo). */
export function canReopenSupportTicket(
  ticket: Pick<SupportTicket, "status" | "resolvedAt" | "internal">,
  role: AdminRole,
  now: Date = new Date(),
): boolean {
  const deadline = reopenDeadlineOf(ticket);
  return role === "admin" && !ticket.internal && deadline !== null && now < deadline;
}
