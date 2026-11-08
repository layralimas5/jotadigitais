import type { AdminRole } from "@/domain/admin-user";
import {
  SupportApprovalError,
  SupportPriorityForbiddenError,
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
  canChangeSupportPriority,
  canChangeSupportStatus,
  canDeleteSupportTicket,
  canChangeSupportVisibility,
  canManageSupportLabels,
  canNotifyAdmin,
  hasUnseenFrom,
  isVisibleTo,
  seenAtBy,
  type SupportNotifyEvent,
  type SupportLabel,
  sortTickets,
  type SupportReply,
  type SupportStatus,
  type SupportPriority,
  type SupportSubmitResult,
  type SupportRole,
  type SupportTicket,
  type SupportUpload,
} from "@/domain/support-ticket";
import type { AdminDeps } from "./admin-use-cases";
import { parseOrThrow, supportLabelSchema, supportPrioritySchema, supportReplySchema, supportStatusSchema, supportTicketDataSchema } from "./schemas";

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

export interface SupportNotifyOption {
  /** A Lay pediu para avisar o Jota no sininho. */
  notifyAdmin?: boolean;
}

/** O aviso é extra: se falhar, o chamado ou a resposta já foram salvos e a tela avisa à parte. */
async function notifyAdminIfAsked(
  deps: AdminDeps,
  role: AdminRole,
  ticket: Pick<SupportTicket, "id" | "internal">,
  event: SupportNotifyEvent,
  option: SupportNotifyOption,
): Promise<boolean> {
  if (!option.notifyAdmin || !canNotifyAdmin(ticket, role)) return true;
  try {
    await deps.support.notifyAdmin(ticket.id, event);
    return true;
  } catch (error) {
    console.error("Falha ao avisar o Jota no sininho", error);
    return false;
  }
}

export async function openSupportTicket(
  deps: AdminDeps,
  role: AdminRole,
  raw: unknown,
  uploads: readonly SupportUpload[] = [],
  option: SupportNotifyOption = {},
): Promise<SupportSubmitResult<SupportTicket> & { notified: boolean }> {
  const data = parseOrThrow(supportTicketDataSchema, raw);
  checkUploads(uploads);
  const result = await deps.support.open({ ...data, internal: data.internal && canChangeSupportVisibility(role) }, uploads);
  return { ...result, notified: await notifyAdminIfAsked(deps, role, result.saved, "opened", option) };
}

/** Na conversa aberta: marca o visto quando aparece coisa nova para quem está vendo. */
export function markSupportTicketSeen(deps: AdminDeps, role: SupportRole, ticket: SupportTicket): Promise<void> | null {
  if (!hasUnseenFrom(ticket, role) && seenAtBy(ticket, role) !== null) return null;
  return deps.support.markSeen(ticket.id, role === "developer" && !ticket.internal);
}

export function setSupportTicketVisibility(deps: AdminDeps, role: AdminRole, ticketId: string, internal: boolean): Promise<void> {
  if (!canChangeSupportVisibility(role)) throw new SupportVisibilityForbiddenError();
  return deps.support.setInternal(ticketId, internal);
}

export async function replyToSupportTicket(
  deps: AdminDeps,
  role: AdminRole,
  ticket: Pick<SupportTicket, "id" | "internal">,
  raw: unknown,
  uploads: readonly SupportUpload[] = [],
  option: SupportNotifyOption = {},
): Promise<SupportSubmitResult<SupportReply> & { notified: boolean }> {
  const { body } = parseOrThrow(supportReplySchema, raw);
  checkUploads(uploads);
  const result = await deps.support.reply(ticket.id, body, uploads);
  return { ...result, notified: await notifyAdminIfAsked(deps, role, ticket, "replied", option) };
}

export function changeSupportStatus(deps: AdminDeps, role: AdminRole, ticketId: string, status: SupportStatus): Promise<void> {
  if (!canChangeSupportStatus(role)) throw new SupportStatusForbiddenError();
  return deps.support.changeStatus(ticketId, parseOrThrow(supportStatusSchema, status));
}

export function changeSupportPriority(
  deps: AdminDeps,
  role: AdminRole,
  ticket: Pick<SupportTicket, "id" | "status">,
  priority: SupportPriority,
): Promise<void> {
  if (!canChangeSupportPriority(ticket, role)) throw new SupportPriorityForbiddenError();
  return deps.support.changePriority(ticket.id, parseOrThrow(supportPrioritySchema, priority));
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
