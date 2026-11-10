import {
  SUPPORT_AREAS,
  SUPPORT_KINDS,
  SUPPORT_PRIORITIES,
  needsActionFrom,
  queueTimeMs,
  sortTickets,
  type SupportArea,
  type SupportKind,
  type SupportPriority,
  type SupportStatus,
  type SupportTicket,
} from "./support-ticket";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Janela dos números de entrega: finalizados e tempo médio. */
export const SUPPORT_RECENT_DAYS = 30;
/** Quantos chamados entram na lista "precisa de você" do dashboard. */
export const SUPPORT_QUEUE_PREVIEW = 6;

export interface CountOf<K extends string> {
  key: K;
  count: number;
}

/** Como está o suporte agora: o que dá para ver de relance no dashboard da desenvolvedora. */
export interface SupportOverview {
  /** Tudo que não está finalizado. */
  open: number;
  /** Pendentes ou com resposta nova do Jota que ela ainda não respondeu. */
  needsYou: number;
  urgent: number;
  inProgress: number;
  waitingAdmin: number;
  /** Finalizados nos últimos SUPPORT_RECENT_DAYS dias. */
  doneRecently: number;
  /** Abertos no mesmo período. */
  openedRecently: number;
  /** Tempo médio (ms) entre abrir e finalizar, nos finalizados do período; nulo sem nenhum. */
  averageResolveMs: number | null;
  /** Há quanto tempo (ms) o chamado em aberto mais antigo espera; nulo sem nenhum em aberto. */
  oldestOpenMs: number | null;
  byKind: CountOf<SupportKind>[];
  byArea: CountOf<SupportArea>[];
  byPriority: CountOf<SupportPriority>[];
  /** O que espera a desenvolvedora, na ordem da fila (urgência primeiro). */
  queue: SupportTicket[];
}

function countBy<K extends string>(keys: readonly K[], tickets: readonly SupportTicket[], keyOf: (ticket: SupportTicket) => K): CountOf<K>[] {
  return keys.map((key) => ({ key, count: tickets.filter((ticket) => keyOf(ticket) === key).length }));
}

const isStatus = (status: SupportStatus) => (ticket: SupportTicket) => ticket.status === status;

export function buildSupportOverview(tickets: readonly SupportTicket[], now: Date = new Date()): SupportOverview {
  const since = now.getTime() - SUPPORT_RECENT_DAYS * DAY_MS;
  const open = tickets.filter((ticket) => ticket.status !== "done");
  const resolvedRecently = tickets.filter(
    (ticket) => ticket.status === "done" && ticket.resolvedAt !== null && new Date(ticket.resolvedAt).getTime() >= since,
  );
  const resolveTimes = resolvedRecently.map((ticket) => queueTimeMs(ticket, now));
  const needsYou = sortTickets(open.filter((ticket) => needsActionFrom(ticket, "developer")));

  return {
    open: open.length,
    needsYou: needsYou.length,
    urgent: open.filter((ticket) => ticket.priority === "urgent").length,
    inProgress: open.filter(isStatus("in_progress")).length,
    waitingAdmin: open.filter(isStatus("waiting")).length,
    doneRecently: resolvedRecently.length,
    openedRecently: tickets.filter((ticket) => new Date(ticket.createdAt).getTime() >= since).length,
    averageResolveMs: resolveTimes.length ? resolveTimes.reduce((sum, ms) => sum + ms, 0) / resolveTimes.length : null,
    oldestOpenMs: open.length ? Math.max(...open.map((ticket) => queueTimeMs(ticket, now))) : null,
    byKind: countBy(SUPPORT_KINDS, open, (ticket) => ticket.kind),
    byArea: countBy(SUPPORT_AREAS, open, (ticket) => ticket.area),
    byPriority: countBy(SUPPORT_PRIORITIES, open, (ticket) => ticket.priority),
    queue: needsYou.slice(0, SUPPORT_QUEUE_PREVIEW),
  };
}
