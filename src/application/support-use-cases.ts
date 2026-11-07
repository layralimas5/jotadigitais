import type { AdminRole } from "@/domain/admin-user";
import {
  SupportApprovalError,
  SupportAttachmentError,
  SupportDeleteForbiddenError,
  SupportLabelForbiddenError,
  SupportStatusForbiddenError,
  SupportVisibilityForbiddenError,
} from "@/domain/errors";
import {
  attachmentProblem,
  MAX_ATTACHMENTS_PER_MESSAGE,
  canApproveSupportTicket,
  canChangeSupportStatus,
  canDeleteSupportTicket,
  canChangeSupportVisibility,
  canManageSupportLabels,
  isVisibleTo,
  type SupportLabel,
  sortTickets,
  type SupportReply,
  type SupportStatus,
  type SupportSubmitResult,
  type SupportTicket,
  type SupportUpload,
} from "@/domain/support-ticket";
import type { AdminDeps } from "./admin-use-cases";
import { parseOrThrow, supportLabelSchema, supportReplySchema, supportStatusSchema, supportTicketDataSchema } from "./schemas";

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

/** O banco já esconde os internos do Jota; o filtro aqui cobre o "ver como o Jota" da desenvolvedora. */
export async function listSupportTickets(deps: AdminDeps, role: AdminRole): Promise<SupportTicket[]> {
  return sortTickets((await deps.support.listAll()).filter((ticket) => isVisibleTo(ticket, role)));
}

export async function findSupportTicket(deps: AdminDeps, role: AdminRole, id: string): Promise<SupportTicket | null> {
  const ticket = await deps.support.findById(id);
  return ticket && isVisibleTo(ticket, role) ? ticket : null;
}

export function openSupportTicket(
  deps: AdminDeps,
  role: AdminRole,
  raw: unknown,
  uploads: readonly SupportUpload[] = [],
): Promise<SupportSubmitResult<SupportTicket>> {
  const data = parseOrThrow(supportTicketDataSchema, raw);
  checkUploads(uploads);
  return deps.support.open({ ...data, internal: data.internal && canChangeSupportVisibility(role) }, uploads);
}

export function setSupportTicketVisibility(deps: AdminDeps, role: AdminRole, ticketId: string, internal: boolean): Promise<void> {
  if (!canChangeSupportVisibility(role)) throw new SupportVisibilityForbiddenError();
  return deps.support.setInternal(ticketId, internal);
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

export function approveSupportTicket(deps: AdminDeps, role: AdminRole, ticket: Pick<SupportTicket, "id" | "status">): Promise<void> {
  if (!canApproveSupportTicket(ticket, role)) throw new SupportApprovalError();
  return deps.support.approve(ticket.id);
}

export function listSupportLabels(deps: AdminDeps): Promise<SupportLabel[]> {
  return deps.support.listLabels();
}

function requireLabelManager(role: AdminRole): void {
  if (!canManageSupportLabels(role)) throw new SupportLabelForbiddenError();
}

export function saveSupportLabel(deps: AdminDeps, role: AdminRole, id: string | null, raw: unknown): Promise<SupportLabel> {
  requireLabelManager(role);
  const data = parseOrThrow(supportLabelSchema, raw);
  return id ? deps.support.updateLabel(id, data) : deps.support.createLabel(data);
}

export function deleteSupportLabel(deps: AdminDeps, role: AdminRole, id: string): Promise<void> {
  requireLabelManager(role);
  return deps.support.removeLabel(id);
}

export function setSupportLabel(deps: AdminDeps, role: AdminRole, ticketId: string, labelId: string | null): Promise<void> {
  requireLabelManager(role);
  return deps.support.setLabel(ticketId, labelId);
}

export function deleteSupportTicket(deps: AdminDeps, role: AdminRole, ticketId: string): Promise<void> {
  if (!canDeleteSupportTicket(role)) throw new SupportDeleteForbiddenError();
  return deps.support.remove(ticketId);
}
