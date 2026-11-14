import type { AuthService, SupportTicketRepository } from "@/application/ports";
import {
  SupportApprovalError,
  SupportDeleteForbiddenError,
  SupportMergeError,
  SupportMergeForbiddenError,
  SupportLabelForbiddenError,
  SupportLabelNameTakenError,
  SupportStatusForbiddenError,
  SupportPriorityForbiddenError,
  SupportTicketNotFoundError,
  SupportVisibilityForbiddenError,
} from "@/domain/errors";
import {
  canApproveSupportTicket,
  canChangeSupportStatus,
  canChangeSupportPriority,
  canChangeSupportVisibility,
  canDeleteSupportTicket,
  canMergeSupportTickets,
  canManageSupportLabels,
  DEFAULT_CANNED_REPLIES,
  isVisibleTo,
  type SupportLabel,
  type SupportLabelData,
  type SupportNotifyEvent,
  type SupportView,
  hasUnseenFrom,
  type SupportStatusEvent,
  type SupportAttachment,
  type SupportAuthor,
  type SupportCannedReply,
  type SupportCannedReplyData,
  type SupportChecklistItem,
  type SupportReply,
  type SupportStatus,
  type SupportPriority,
  type SupportSubmitResult,
  type SupportTicket,
  type SupportTicketData,
  type SupportUpload,
} from "@/domain/support-ticket";
import type { StoredNotification } from "@/domain/notification";
import type { AdminRole } from "@/domain/admin-user";
import { newId, simulateLatency, type DemoDatabase } from "./demo-database";
import { MAX_NOTIFICATIONS, notificationsOf } from "./demo-repositories";

/** Responder avisando e encaminhar no mesmo envio vira um aviso só. */
const FORWARD_NOTICE_WINDOW_MS = 2 * 60_000;

const MERGED_REPLY_MESSAGE = "Este chamado foi juntado a outro. Responda no chamado principal.";

/** Troca a última vez que esse papel viu o chamado. */
const withView = (views: readonly SupportView[], role: AdminRole, seenAt: string): SupportView[] => [
  ...views.filter((view) => view.role !== role),
  { role, seenAt },
];

const statusEvent = (from: SupportStatus | null, to: SupportStatus, author: SupportAuthor | null, at: string): SupportStatusEvent => ({
  id: newId("evt"),
  from,
  to,
  author,
  createdAt: at,
});

/** Mesma regra do índice único do banco: nome sem diferenciar maiúsculas nem espaços nas pontas. */
function assertUniqueName(labels: readonly SupportLabel[], name: string, exceptId: string | null): void {
  const key = name.trim().toLowerCase();
  if (labels.some((label) => label.id !== exceptId && label.name.trim().toLowerCase() === key)) throw new SupportLabelNameTakenError(name.trim());
}

/** Chamado salvo antes da checklist, da previsão e do "no ar": os campos novos entram vazios. */
const withNewFields = (ticket: SupportTicket): SupportTicket => ({
  ...ticket,
  checklist: ticket.checklist ?? [],
  dueDate: ticket.dueDate ?? null,
  releasedAt: ticket.releasedAt ?? null,
});

/**
 * Chamados no navegador. Quem escreve é quem está logado no modo demo, como o banco faria.
 * Os anexos ficam só na memória desta aba (vídeo não cabe no localStorage): recarregar a página os perde.
 */
export class DemoSupportTicketRepository implements SupportTicketRepository {
  private readonly files = new Map<string, string>();

  constructor(
    private readonly db: DemoDatabase,
    private readonly auth: AuthService,
  ) {}

  /** Igual ao banco: interno só para a desenvolvedora. */
  async listAll(): Promise<SupportTicket[]> {
    const role = (await this.currentAuthor()).role;
    return structuredClone(this.db.read().supportTickets ?? [])
      .map((ticket) => this.withUrls(withNewFields(ticket)))
      .filter((ticket) => isVisibleTo(ticket, role));
  }

  async findById(id: string): Promise<SupportTicket | null> {
    return (await this.listAll()).find((ticket) => ticket.id === id) ?? null;
  }

  async open(data: SupportTicketData, uploads: readonly SupportUpload[]): Promise<SupportSubmitResult<SupportTicket>> {
    await simulateLatency();
    const now = new Date().toISOString();
    const ticket: SupportTicket = {
      ...data,
      id: newId("sup"),
      status: "open",
      author: await this.currentAuthor(),
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
      replies: [],
      attachments: this.store(uploads, null),
      labelId: null,
      events: [],
      views: [{ role: (await this.currentAuthor()).role, seenAt: now }],
      mergedInto: null,
      mergedAt: null,
      merged: [],
      checklist: [],
      dueDate: null,
      releasedAt: null,
    };
    this.db.write((state) => {
      state.supportTickets = [ticket, ...(state.supportTickets ?? [])];
    });
    return { saved: this.withUrls(ticket), failedUploads: [] };
  }

  async reply(ticketId: string, body: string, uploads: readonly SupportUpload[], replyToId: string | null): Promise<SupportSubmitResult<SupportReply>> {
    await simulateLatency();
    const author = await this.currentAuthor();
    if (this.db.read().supportTickets?.find((item) => item.id === ticketId)?.mergedInto) throw new SupportMergeError(MERGED_REPLY_MESSAGE);
    const reply: SupportReply = { id: newId("rep"), body, author, createdAt: new Date().toISOString(), replyToId };
    const attachments = this.store(uploads, reply.id);
    this.updateTicket(ticketId, (ticket) => {
      // Igual ao banco: resposta do Jota num chamado que esperava por ele volta para a fila (troca automática, sem autor).
      const reopens = ticket.status === "waiting" && author.role === "admin";
      return {
        ...ticket,
        status: reopens ? "open" : ticket.status,
        events: reopens ? [...ticket.events, statusEvent("waiting", "open", null, reply.createdAt)] : ticket.events,
        replies: [...ticket.replies, reply],
        attachments: [...ticket.attachments, ...attachments],
        views: withView(ticket.views, author.role, reply.createdAt),
        updatedAt: reply.createdAt,
      };
    });
    return { saved: reply, failedUploads: [] };
  }

  async changeStatus(ticketId: string, status: SupportStatus): Promise<void> {
    await simulateLatency();
    const author = await this.currentAuthor();
    if (!canChangeSupportStatus(author.role)) throw new SupportStatusForbiddenError();
    const now = new Date().toISOString();
    const before = this.db.read().supportTickets?.find((item) => item.id === ticketId);
    this.updateTicket(ticketId, (ticket) =>
      ticket.status === status
        ? ticket
        : {
            ...ticket,
            status,
            updatedAt: now,
            resolvedAt: status === "done" ? now : null,
            events: [...ticket.events, statusEvent(ticket.status, status, author, now)],
          },
    );
    // Mesma regra do gatilho notify_admin_on_forward: encaminhar para o Jota avisa, sem repetir aviso recente.
    if (before && status === "waiting" && before.status !== "waiting" && author.role === "developer" && !this.recentlyNotified(before.id)) {
      this.notifyJota(before, `Layra encaminhou para você: ${before.title}`, "Está aguardando a sua análise, resposta ou aprovação.");
    }
  }

  private recentlyNotified(ticketId: string): boolean {
    const since = Date.now() - FORWARD_NOTICE_WINDOW_MS;
    return notificationsOf(this.db.read()).some(
      (notification) => notification.link === `/admin/suporte/${ticketId}` && Date.parse(notification.createdAt) > since,
    );
  }

  /** Mesma regra da função set_support_ticket_priority do banco. */
  async changePriority(ticketId: string, priority: SupportPriority): Promise<void> {
    await simulateLatency();
    const author = await this.currentAuthor();
    const ticket = this.db.read().supportTickets?.find((item) => item.id === ticketId);
    if (!ticket) throw new SupportTicketNotFoundError();
    if (!canChangeSupportPriority(ticket, author.role)) throw new SupportPriorityForbiddenError();
    this.updateTicket(ticketId, (current) => (current.priority === priority ? current : { ...current, priority, updatedAt: new Date().toISOString() }));
  }

  /** Mesma regra da função mark_support_ticket_seen do banco. */
  async markSeen(ticketId: string, notify: boolean): Promise<void> {
    const viewer = await this.currentAuthor();
    const now = new Date().toISOString();
    const before = (await this.findById(ticketId)) ?? null;
    if (!before) throw new SupportTicketNotFoundError();
    const hasNews = notify && viewer.role === "developer" && hasUnseenFrom(before, "developer");
    this.updateTicket(ticketId, (ticket) => ({ ...ticket, views: withView(ticket.views, viewer.role, now) }));
    if (hasNews) this.notifyJota(before, `Layra viu: ${before.title}`, "Ela já está por dentro do que você mandou.");
  }

  async notifyAdmin(ticketId: string, event: SupportNotifyEvent): Promise<void> {
    const author = await this.currentAuthor();
    if (author.role !== "developer") throw new SupportStatusForbiddenError();
    const ticket = this.db.read().supportTickets?.find((item) => item.id === ticketId);
    if (!ticket) throw new SupportTicketNotFoundError();
    if (event === "opened") this.notifyJota(ticket, `Layra abriu um chamado: ${ticket.title}`, ticket.description);
    else {
      const last = ticket.replies.filter((reply) => reply.author?.role === "developer").at(-1);
      this.notifyJota(ticket, `Layra respondeu: ${ticket.title}`, last?.body ?? null);
    }
  }

  private notifyJota(ticket: SupportTicket, title: string, body: string | null): void {
    if (ticket.internal) return;
    const notification: StoredNotification = {
      id: newId("ntf"),
      kind: "support",
      title: title.slice(0, 120),
      body: body ? body.slice(0, 500) : null,
      link: `/admin/suporte/${ticket.id}`,
      createdAt: new Date().toISOString(),
    };
    this.db.write((state) => {
      state.notifications = [notification, ...notificationsOf(state)].slice(0, MAX_NOTIFICATIONS);
    });
  }

  async setInternal(ticketId: string, internal: boolean): Promise<void> {
    await simulateLatency();
    if (!canChangeSupportVisibility((await this.currentAuthor()).role)) throw new SupportVisibilityForbiddenError();
    this.updateTicket(ticketId, (ticket) => ({ ...ticket, internal }));
  }

  async approve(ticketId: string): Promise<void> {
    await simulateLatency();
    const author = await this.currentAuthor();
    const ticket = this.db.read().supportTickets?.find((item) => item.id === ticketId);
    if (!ticket) throw new SupportTicketNotFoundError();
    if (!canApproveSupportTicket(ticket, author.role)) throw new SupportApprovalError();
    const now = new Date().toISOString();
    this.updateTicket(ticketId, (current) => ({
      ...current,
      status: "done",
      updatedAt: now,
      resolvedAt: now,
      events: [...current.events, statusEvent(current.status, "done", author, now)],
    }));
  }

  async listLabels(): Promise<SupportLabel[]> {
    return structuredClone(this.db.read().supportLabels ?? []);
  }

  async createLabel(data: SupportLabelData): Promise<SupportLabel> {
    await this.requireLabelManager();
    const label: SupportLabel = { ...data, id: newId("lbl") };
    this.db.write((state) => {
      assertUniqueName(state.supportLabels ?? [], data.name, null);
      state.supportLabels = [...(state.supportLabels ?? []), label];
    });
    return label;
  }

  async updateLabel(id: string, data: SupportLabelData): Promise<SupportLabel> {
    await this.requireLabelManager();
    const label: SupportLabel = { ...data, id };
    this.db.write((state) => {
      assertUniqueName(state.supportLabels ?? [], data.name, id);
      state.supportLabels = (state.supportLabels ?? []).map((current) => (current.id === id ? label : current));
    });
    return label;
  }

  async removeLabel(id: string): Promise<void> {
    await this.requireLabelManager();
    this.db.write((state) => {
      state.supportLabels = (state.supportLabels ?? []).filter((label) => label.id !== id);
      state.supportTickets = (state.supportTickets ?? []).map((ticket) => (ticket.labelId === id ? { ...ticket, labelId: null } : ticket));
    });
  }

  async setLabel(ticketId: string, labelId: string | null): Promise<void> {
    await simulateLatency();
    await this.requireLabelManager();
    this.updateTicket(ticketId, (ticket) => ({ ...ticket, labelId, updatedAt: new Date().toISOString() }));
  }

  async remove(ticketId: string): Promise<void> {
    await simulateLatency();
    if (!canDeleteSupportTicket((await this.currentAuthor()).role)) throw new SupportDeleteForbiddenError();
    this.db.write((state) => {
      const tickets = state.supportTickets ?? [];
      if (!tickets.some((ticket) => ticket.id === ticketId)) throw new SupportTicketNotFoundError();
      state.supportTickets = tickets.filter((ticket) => ticket.id !== ticketId);
    });
  }

  async listMergedInto(ticketId: string): Promise<SupportTicket[]> {
    return (await this.listAll()).filter((ticket) => ticket.mergedInto === ticketId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  /** Mesma regra da função merge_support_tickets do banco. */
  async merge(targetId: string, sourceIds: readonly string[]): Promise<void> {
    await simulateLatency();
    if (!canMergeSupportTickets((await this.currentAuthor()).role)) throw new SupportMergeForbiddenError();
    const now = new Date().toISOString();
    this.db.write((state) => {
      const tickets = state.supportTickets ?? [];
      const target = tickets.find((ticket) => ticket.id === targetId);
      if (!target || sourceIds.some((id) => !tickets.some((ticket) => ticket.id === id))) throw new SupportTicketNotFoundError();
      if (target.mergedInto) throw new SupportMergeError();
      const sources = new Set(sourceIds);
      const moved = tickets.map((ticket) => {
        if (sources.has(ticket.id)) return { ...ticket, mergedInto: targetId, mergedAt: now, updatedAt: now };
        if (ticket.mergedInto && sources.has(ticket.mergedInto)) return { ...ticket, mergedInto: targetId };
        return ticket;
      });
      const opensToAdmin = target.internal && moved.some((ticket) => ticket.mergedInto === targetId && !ticket.internal);
      state.supportTickets = moved.map((ticket) => (ticket.id === targetId && opensToAdmin ? { ...ticket, internal: false } : ticket));
    });
  }

  async unmerge(ticketId: string): Promise<void> {
    await simulateLatency();
    if (!canMergeSupportTickets((await this.currentAuthor()).role)) throw new SupportMergeForbiddenError();
    this.updateTicket(ticketId, (ticket) => {
      if (!ticket.mergedInto) throw new SupportTicketNotFoundError();
      return { ...ticket, mergedInto: null, mergedAt: null };
    });
  }

  async addChecklistItems(ticketId: string, bodies: readonly string[]): Promise<void> {
    await this.requireDeveloper();
    this.updateTicket(ticketId, (ticket) => {
      const start = ticket.checklist.reduce((max, item) => Math.max(max, item.position), -1) + 1;
      const added = bodies.map((body, index): SupportChecklistItem => ({ id: newId("chk"), body, done: false, position: start + index, doneAt: null }));
      return { ...ticket, checklist: [...ticket.checklist, ...added] };
    });
  }

  async updateChecklistItem(itemId: string, change: { body?: string; done?: boolean }): Promise<void> {
    await this.requireDeveloper();
    const ticket = this.ticketWithItem(itemId);
    this.updateTicket(ticket.id, (current) => ({
      ...current,
      checklist: current.checklist.map((item) => {
        if (item.id !== itemId) return item;
        const done = change.done ?? item.done;
        return { ...item, body: change.body ?? item.body, done, doneAt: done === item.done ? item.doneAt : done ? new Date().toISOString() : null };
      }),
    }));
  }

  async removeChecklistItem(itemId: string): Promise<void> {
    await this.requireDeveloper();
    const ticket = this.ticketWithItem(itemId);
    this.updateTicket(ticket.id, (current) => ({ ...current, checklist: current.checklist.filter((item) => item.id !== itemId) }));
  }

  async setDueDate(ticketId: string, dueDate: string | null): Promise<void> {
    await this.requireDeveloper();
    this.updateTicket(ticketId, (ticket) => ({ ...ticket, dueDate }));
  }

  /** Mesma regra da set_support_ticket_released do banco. */
  async setReleased(ticketId: string, released: boolean): Promise<void> {
    await simulateLatency();
    const author = await this.requireDeveloper();
    const ticket = this.db.read().supportTickets?.find((item) => item.id === ticketId);
    if (!ticket) throw new SupportTicketNotFoundError();
    if (!released) {
      this.updateTicket(ticketId, (current) => ({ ...current, releasedAt: null }));
      return;
    }
    if (ticket.releasedAt) return;
    const now = new Date().toISOString();
    this.notifyJota(ticket, `Já está no ar: ${ticket.title}`, "Confere no site ou no painel e, se estiver tudo certo, aprova o chamado.");
    this.updateTicket(ticketId, (current) => {
      const forwards = !current.internal && (current.status === "open" || current.status === "in_progress");
      return {
        ...current,
        releasedAt: now,
        status: forwards ? "waiting" : current.status,
        updatedAt: now,
        events: forwards ? [...current.events, statusEvent(current.status, "waiting", author, now)] : current.events,
      };
    });
  }

  /** Sem nada salvo ainda, o modo demo começa com as três respostas de fábrica (como a migration). */
  async listCannedReplies(): Promise<SupportCannedReply[]> {
    await this.requireDeveloper();
    return [...this.cannedReplies()].sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
  }

  async createCannedReply(data: SupportCannedReplyData): Promise<SupportCannedReply> {
    await this.requireDeveloper();
    const created: SupportCannedReply = { ...data, id: newId("rpl") };
    const current = this.cannedReplies();
    this.db.write((state) => {
      state.supportCannedReplies = [...current, created];
    });
    return created;
  }

  async updateCannedReply(id: string, data: SupportCannedReplyData): Promise<SupportCannedReply> {
    await this.requireDeveloper();
    const current = this.cannedReplies();
    if (!current.some((item) => item.id === id)) throw new SupportTicketNotFoundError();
    const updated: SupportCannedReply = { ...data, id };
    this.db.write((state) => {
      state.supportCannedReplies = current.map((item) => (item.id === id ? updated : item));
    });
    return updated;
  }

  async removeCannedReply(id: string): Promise<void> {
    await this.requireDeveloper();
    const current = this.cannedReplies();
    this.db.write((state) => {
      state.supportCannedReplies = current.filter((item) => item.id !== id);
    });
  }

  private cannedReplies(): SupportCannedReply[] {
    return this.db.read().supportCannedReplies ?? DEFAULT_CANNED_REPLIES.map((reply, index) => ({ ...reply, id: `rpl_default_${index}` }));
  }

  private ticketWithItem(itemId: string): SupportTicket {
    const ticket = (this.db.read().supportTickets ?? []).find((item) => (item.checklist ?? []).some((entry) => entry.id === itemId));
    if (!ticket) throw new SupportTicketNotFoundError();
    return ticket;
  }

  private async requireDeveloper(): Promise<SupportAuthor> {
    const author = await this.currentAuthor();
    if (author.role !== "developer") throw new SupportStatusForbiddenError();
    return author;
  }

  private async requireLabelManager(): Promise<void> {
    if (!canManageSupportLabels((await this.currentAuthor()).role)) throw new SupportLabelForbiddenError();
  }

  /** Guarda o arquivo na memória e devolve o anexo sem endereço (o endereço é posto na leitura). */
  private store(uploads: readonly SupportUpload[], replyId: string | null): SupportAttachment[] {
    return uploads.map((upload) => {
      const id = newId("att");
      this.files.set(id, URL.createObjectURL(upload.file));
      return { id, kind: upload.kind, name: upload.name, url: null, replyId };
    });
  }

  private withUrls(ticket: SupportTicket): SupportTicket {
    // Chamados salvos antes dos anexos existirem chegam sem a lista.
    const attachments = ticket.attachments ?? [];
    return {
      ...ticket,
      kind: ticket.kind ?? "task",
      internal: ticket.internal ?? false,
      views: ticket.views ?? [],
      labelId: ticket.labelId ?? null,
      events: ticket.events ?? [],
      mergedInto: ticket.mergedInto ?? null,
      mergedAt: ticket.mergedAt ?? null,
      merged: [],
      attachments: attachments.map((attachment) => ({ ...attachment, url: this.files.get(attachment.id) ?? null })),
    };
  }

  private updateTicket(id: string, change: (ticket: SupportTicket) => SupportTicket): void {
    this.db.write((state) => {
      const tickets = state.supportTickets ?? [];
      if (!tickets.some((ticket) => ticket.id === id)) throw new SupportTicketNotFoundError();
      state.supportTickets = tickets.map((ticket) =>
        ticket.id === id ? change(withNewFields({ ...ticket, attachments: ticket.attachments ?? [], events: ticket.events ?? [], views: ticket.views ?? [], labelId: ticket.labelId ?? null })) : ticket,
      );
    });
  }

  private async currentAuthor(): Promise<SupportAuthor> {
    const state = await this.auth.getState();
    if (state.status !== "signed-in") throw new Error("Entre no sistema para usar o suporte.");
    return { name: state.session.name, role: state.session.role, avatarUrl: state.session.avatarUrl };
  }
}
