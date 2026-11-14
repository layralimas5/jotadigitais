import type { AdminRole } from "@/domain/admin-user";
import { buildSupportOverview, type SupportOverview } from "@/domain/support-overview";
import {
  SupportApprovalError,
  SupportPriorityForbiddenError,
  SupportAttachmentError,
  SupportDeleteForbiddenError,
  SupportMergeError,
  SupportMergeForbiddenError,
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
  canMergeSupportTickets,
  nestMergedTickets,
  canNotifyAdmin,
  checklistItemsFromText,
  hasUnseenFrom,
  isQuotableIn,
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
import { parseOrThrow, ValidationError, supportLabelSchema, supportPrioritySchema, supportReplySchema, supportStatusSchema, supportTicketDataSchema } from "./schemas";

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
  return sortTickets(nestMergedTickets((await deps.support.listAll()).filter((ticket) => isVisibleTo(ticket, role))));
}

/** Números do suporte para o dashboard de quem mantém o sistema. */
export async function loadSupportOverview(deps: AdminDeps, role: AdminRole): Promise<SupportOverview> {
  return buildSupportOverview(await listSupportTickets(deps, role));
}

/** Com os chamados juntados nele, para a conversa deles aparecer dentro do principal. */
export async function findSupportTicket(deps: AdminDeps, role: AdminRole, id: string): Promise<SupportTicket | null> {
  const ticket = await deps.support.findById(id);
  if (!ticket || !isVisibleTo(ticket, role)) return null;
  const merged = await deps.support.listMergedInto(ticket.id);
  return { ...ticket, merged: merged.filter((child) => isVisibleTo(child, role)) };
}

/** Junta os chamados escolhidos no principal. Precisa de pelo menos um além dele. */
export function mergeSupportTickets(deps: AdminDeps, role: AdminRole, targetId: string, sourceIds: readonly string[]): Promise<void> {
  if (!canMergeSupportTickets(role)) throw new SupportMergeForbiddenError();
  const sources = [...new Set(sourceIds)].filter((id) => id !== targetId);
  if (sources.length === 0) throw new SupportMergeError("Escolha pelo menos dois chamados para juntar.");
  return deps.support.merge(targetId, sources);
}

export function unmergeSupportTicket(deps: AdminDeps, role: AdminRole, ticketId: string): Promise<void> {
  if (!canMergeSupportTickets(role)) throw new SupportMergeForbiddenError();
  return deps.support.unmerge(ticketId);
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
  ticket: Pick<SupportTicket, "id" | "internal" | "replies">,
  raw: unknown,
  uploads: readonly SupportUpload[] = [],
  option: SupportNotifyOption = {},
): Promise<SupportSubmitResult<SupportReply> & { notified: boolean }> {
  const { body, replyToId } = parseOrThrow(supportReplySchema, raw);
  checkUploads(uploads);
  // Mensagem citada que sumiu (ou de outro chamado) não trava o envio: a resposta vai sem a citação.
  const target = replyToId && isQuotableIn(ticket, replyToId) ? replyToId : null;
  const result = await deps.support.reply(ticket.id, body, uploads, target);
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

// ---------------------------------------------------------------------------
// Checklist, previsão e publicação: só a desenvolvedora mexe (o banco confere de novo)
// ---------------------------------------------------------------------------

function requireDeveloper(role: AdminRole): void {
  if (role !== "developer") throw new SupportStatusForbiddenError();
}

/** Cada linha do texto vira um item no fim da checklist. Devolve quantos entraram. */
export async function addSupportChecklistItems(deps: AdminDeps, role: AdminRole, ticketId: string, text: string): Promise<number> {
  requireDeveloper(role);
  const bodies = checklistItemsFromText(text);
  if (bodies.length === 0) throw new ValidationError("Escreva pelo menos um item.", { checklist: "Escreva pelo menos um item." });
  await deps.support.addChecklistItems(ticketId, bodies);
  return bodies.length;
}

export function toggleSupportChecklistItem(deps: AdminDeps, role: AdminRole, itemId: string, done: boolean): Promise<void> {
  requireDeveloper(role);
  return deps.support.updateChecklistItem(itemId, { done });
}

export function removeSupportChecklistItem(deps: AdminDeps, role: AdminRole, itemId: string): Promise<void> {
  requireDeveloper(role);
  return deps.support.removeChecklistItem(itemId);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Previsão de entrega: AAAA-MM-DD do campo de data, ou nula para tirar. */
export function setSupportDueDate(deps: AdminDeps, role: AdminRole, ticketId: string, dueDate: string | null): Promise<void> {
  requireDeveloper(role);
  if (dueDate !== null && (!ISO_DATE.test(dueDate) || Number.isNaN(Date.parse(dueDate)))) {
    throw new ValidationError("Data de previsão inválida.", { dueDate: "Data inválida." });
  }
  return deps.support.setDueDate(ticketId, dueDate);
}

/** "Já está no ar": avisa o Jota e passa o chamado para ele conferir. Desmarcar só tira o selo. */
export function setSupportReleased(deps: AdminDeps, role: AdminRole, ticketId: string, released: boolean): Promise<void> {
  requireDeveloper(role);
  return deps.support.setReleased(ticketId, released);
}
