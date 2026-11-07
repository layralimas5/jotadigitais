import type { AdminRole } from "@/domain/admin-user";
import { SupportAttachmentError, SupportStatusForbiddenError } from "@/domain/errors";
import {
  attachmentProblem,
  MAX_ATTACHMENTS_PER_MESSAGE,
  canChangeSupportStatus,
  sortTickets,
  type SupportReply,
  type SupportStatus,
  type SupportSubmitResult,
  type SupportTicket,
  type SupportUpload,
} from "@/domain/support-ticket";
import type { AdminDeps } from "./admin-use-cases";
import { parseOrThrow, supportReplySchema, supportStatusSchema, supportTicketDataSchema } from "./schemas";

/** Confere os arquivos antes de salvar qualquer coisa: tipo, tamanho e quantidade. */
function checkUploads(uploads: readonly SupportUpload[]): void {
  if (uploads.length > MAX_ATTACHMENTS_PER_MESSAGE) {
    throw new SupportAttachmentError(`Envie no máximo ${MAX_ATTACHMENTS_PER_MESSAGE} arquivos por mensagem.`);
  }
  for (const upload of uploads) {
    const problem = attachmentProblem({ name: upload.name, type: upload.contentType, size: upload.file.size });
    if (problem) throw new SupportAttachmentError(problem);
  }
}

export async function listSupportTickets(deps: AdminDeps): Promise<SupportTicket[]> {
  return sortTickets(await deps.support.listAll());
}

export function findSupportTicket(deps: AdminDeps, id: string): Promise<SupportTicket | null> {
  return deps.support.findById(id);
}

export function openSupportTicket(
  deps: AdminDeps,
  raw: unknown,
  uploads: readonly SupportUpload[] = [],
): Promise<SupportSubmitResult<SupportTicket>> {
  const data = parseOrThrow(supportTicketDataSchema, raw);
  checkUploads(uploads);
  return deps.support.open(data, uploads);
}

export function replyToSupportTicket(
  deps: AdminDeps,
  ticketId: string,
  raw: unknown,
  uploads: readonly SupportUpload[] = [],
): Promise<SupportSubmitResult<SupportReply>> {
  const { body } = parseOrThrow(supportReplySchema, raw);
  checkUploads(uploads);
  return deps.support.reply(ticketId, body, uploads);
}

export function changeSupportStatus(deps: AdminDeps, role: AdminRole, ticketId: string, status: SupportStatus): Promise<void> {
  if (!canChangeSupportStatus(role)) throw new SupportStatusForbiddenError();
  return deps.support.changeStatus(ticketId, parseOrThrow(supportStatusSchema, status));
}
