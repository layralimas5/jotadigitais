import type { AuthService, SupportTicketRepository } from "@/application/ports";
import { SupportStatusForbiddenError, SupportTicketNotFoundError } from "@/domain/errors";
import {
  canChangeSupportStatus,
  type SupportAuthor,
  type SupportReply,
  type SupportStatus,
  type SupportTicket,
  type SupportTicketData,
} from "@/domain/support-ticket";
import { newId, simulateLatency, type DemoDatabase } from "./demo-database";

/** Chamados no navegador. Quem escreve é quem está logado no modo demo, como o banco faria. */
export class DemoSupportTicketRepository implements SupportTicketRepository {
  constructor(
    private readonly db: DemoDatabase,
    private readonly auth: AuthService,
  ) {}

  async listAll(): Promise<SupportTicket[]> {
    return structuredClone(this.db.read().supportTickets ?? []);
  }

  async findById(id: string): Promise<SupportTicket | null> {
    return (await this.listAll()).find((ticket) => ticket.id === id) ?? null;
  }

  async open(data: SupportTicketData): Promise<SupportTicket> {
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
    };
    return this.db.write((state) => {
      state.supportTickets = [ticket, ...(state.supportTickets ?? [])];
      return ticket;
    });
  }

  async reply(ticketId: string, body: string): Promise<SupportReply> {
    await simulateLatency();
    const reply: SupportReply = { id: newId("rep"), body, author: await this.currentAuthor(), createdAt: new Date().toISOString() };
    this.updateTicket(ticketId, (ticket) => ({ ...ticket, replies: [...ticket.replies, reply], updatedAt: reply.createdAt }));
    return reply;
  }

  async changeStatus(ticketId: string, status: SupportStatus): Promise<void> {
    await simulateLatency();
    const author = await this.currentAuthor();
    if (!canChangeSupportStatus(author.role)) throw new SupportStatusForbiddenError();
    const now = new Date().toISOString();
    this.updateTicket(ticketId, (ticket) => ({ ...ticket, status, updatedAt: now, resolvedAt: status === "done" ? now : null }));
  }

  private updateTicket(id: string, change: (ticket: SupportTicket) => SupportTicket): void {
    this.db.write((state) => {
      const tickets = state.supportTickets ?? [];
      if (!tickets.some((ticket) => ticket.id === id)) throw new SupportTicketNotFoundError();
      state.supportTickets = tickets.map((ticket) => (ticket.id === id ? change(ticket) : ticket));
    });
  }

  private async currentAuthor(): Promise<SupportAuthor> {
    const state = await this.auth.getState();
    if (state.status !== "signed-in") throw new Error("Entre no sistema para usar o suporte.");
    return { name: state.session.name, role: state.session.role };
  }
}
