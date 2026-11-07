import type { AdminRole } from "@/domain/admin-user";
import { SupportStatusForbiddenError } from "@/domain/errors";
import {
  canChangeSupportStatus,
  sortTickets,
  type SupportReply,
  type SupportStatus,
  type SupportTicket,
} from "@/domain/support-ticket";
import type { AdminDeps } from "./admin-use-cases";
import { parseOrThrow, supportReplySchema, supportStatusSchema, supportTicketDataSchema } from "./schemas";

export async function listSupportTickets(deps: AdminDeps): Promise<SupportTicket[]> {
  return sortTickets(await deps.support.listAll());
}

export function findSupportTicket(deps: AdminDeps, id: string): Promise<SupportTicket | null> {
  return deps.support.findById(id);
}

export function openSupportTicket(deps: AdminDeps, raw: unknown): Promise<SupportTicket> {
  return deps.support.open(parseOrThrow(supportTicketDataSchema, raw));
}

export function replyToSupportTicket(deps: AdminDeps, ticketId: string, raw: unknown): Promise<SupportReply> {
  const { body } = parseOrThrow(supportReplySchema, raw);
  return deps.support.reply(ticketId, body);
}

export function changeSupportStatus(deps: AdminDeps, role: AdminRole, ticketId: string, status: SupportStatus): Promise<void> {
  if (!canChangeSupportStatus(role)) throw new SupportStatusForbiddenError();
  return deps.support.changeStatus(ticketId, parseOrThrow(supportStatusSchema, status));
}
