import type { AuthService, SupportTicketRepository } from "@/application/ports";
import { SupportStatusForbiddenError, SupportTicketNotFoundError } from "@/domain/errors";
import {
  canChangeSupportStatus,
  type SupportAttachment,
  type SupportAuthor,
  type SupportReply,
  type SupportStatus,
  type SupportSubmitResult,
  type SupportTicket,
  type SupportTicketData,
  type SupportUpload,
} from "@/domain/support-ticket";
import { newId, simulateLatency, type DemoDatabase } from "./demo-database";

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

  async listAll(): Promise<SupportTicket[]> {
    return structuredClone(this.db.read().supportTickets ?? []).map((ticket) => this.withUrls(ticket));
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
    };
    this.db.write((state) => {
      state.supportTickets = [ticket, ...(state.supportTickets ?? [])];
    });
    return { saved: this.withUrls(ticket), failedUploads: [] };
  }

  async reply(ticketId: string, body: string, uploads: readonly SupportUpload[]): Promise<SupportSubmitResult<SupportReply>> {
    await simulateLatency();
    const author = await this.currentAuthor();
    const reply: SupportReply = { id: newId("rep"), body, author, createdAt: new Date().toISOString() };
    const attachments = this.store(uploads, reply.id);
    this.updateTicket(ticketId, (ticket) => ({
      ...ticket,
      // Igual ao banco: resposta do Jota num chamado que esperava por ele volta para a fila.
      status: ticket.status === "waiting" && author.role === "admin" ? "open" : ticket.status,
      replies: [...ticket.replies, reply],
      attachments: [...ticket.attachments, ...attachments],
      updatedAt: reply.createdAt,
    }));
    return { saved: reply, failedUploads: [] };
  }

  async changeStatus(ticketId: string, status: SupportStatus): Promise<void> {
    await simulateLatency();
    const author = await this.currentAuthor();
    if (!canChangeSupportStatus(author.role)) throw new SupportStatusForbiddenError();
    const now = new Date().toISOString();
    this.updateTicket(ticketId, (ticket) => ({ ...ticket, status, updatedAt: now, resolvedAt: status === "done" ? now : null }));
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
    return { ...ticket, kind: ticket.kind ?? "task", attachments: attachments.map((attachment) => ({ ...attachment, url: this.files.get(attachment.id) ?? null })) };
  }

  private updateTicket(id: string, change: (ticket: SupportTicket) => SupportTicket): void {
    this.db.write((state) => {
      const tickets = state.supportTickets ?? [];
      if (!tickets.some((ticket) => ticket.id === id)) throw new SupportTicketNotFoundError();
      state.supportTickets = tickets.map((ticket) => (ticket.id === id ? change({ ...ticket, attachments: ticket.attachments ?? [] }) : ticket));
    });
  }

  private async currentAuthor(): Promise<SupportAuthor> {
    const state = await this.auth.getState();
    if (state.status !== "signed-in") throw new Error("Entre no sistema para usar o suporte.");
    return { name: state.session.name, role: state.session.role };
  }
}
