import { supportRoleOf, type SupportAuthor, type SupportRole, type SupportTicket } from "./support-ticket";

/** Novidade do outro lado da conversa: chamado aberto ou resposta nova. */
export interface SupportActivity {
  /** Única por mensagem: o mesmo aviso nunca aparece duas vezes. */
  key: string;
  kind: "opened" | "replied";
  ticketId: string;
  ticketTitle: string;
  author: SupportAuthor;
  body: string;
  createdAt: string;
}

/** Ids de chamados e respostas já conhecidos: a comparação entre uma leitura e a seguinte. */
export type SupportSnapshot = ReadonlySet<string>;

const ticketKey = (id: string) => `ticket:${id}`;
const replyKey = (id: string) => `reply:${id}`;

const keysOf = (ticket: SupportTicket): string[] => [
  ticketKey(ticket.id),
  ...ticket.replies.map((reply) => replyKey(reply.id)),
  // Juntados também contam: separar um chamado não é novidade.
  ...ticket.merged.flatMap(keysOf),
];

export function snapshotOf(tickets: readonly SupportTicket[]): SupportSnapshot {
  return new Set(tickets.flatMap(keysOf));
}

const isFromOtherSide = (author: SupportAuthor | null, role: SupportRole): author is SupportAuthor =>
  author !== null && supportRoleOf(author.role) !== role;

/**
 * O que apareceu desde a leitura anterior e foi escrito pela outra pessoa, do mais antigo para o mais novo.
 * O que a própria pessoa escreveu nunca vira aviso. Chamado que acabou de aparecer (aberto agora ou que deixou
 * de ser interno) avisa uma vez só, pela abertura, sem repetir a conversa que já existia.
 */
export function newSupportActivity(previous: SupportSnapshot, tickets: readonly SupportTicket[], role: SupportRole): SupportActivity[] {
  const activity: SupportActivity[] = [];
  for (const ticket of tickets) {
    const base = { ticketId: ticket.id, ticketTitle: ticket.title };
    if (!previous.has(ticketKey(ticket.id))) {
      if (isFromOtherSide(ticket.author, role)) {
        activity.push({ ...base, key: ticketKey(ticket.id), kind: "opened", author: ticket.author, body: ticket.description, createdAt: ticket.createdAt });
      }
      continue;
    }
    for (const reply of ticket.replies) {
      if (previous.has(replyKey(reply.id)) || !isFromOtherSide(reply.author, role)) continue;
      activity.push({ ...base, key: replyKey(reply.id), kind: "replied", author: reply.author, body: reply.body, createdAt: reply.createdAt });
    }
  }
  return activity.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
