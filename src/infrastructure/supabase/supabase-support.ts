import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { SupportTicketRepository } from "@/application/ports";
import { SupportTicketNotFoundError } from "@/domain/errors";
import {
  SUPPORT_AREAS,
  SUPPORT_PRIORITIES,
  SUPPORT_STATUSES,
  type SupportAuthor,
  type SupportReply,
  type SupportStatus,
  type SupportTicket,
  type SupportTicketData,
} from "@/domain/support-ticket";
import { fail } from "./supabase-repositories";

// O autor vem de admin_users pela chave estrangeira: nome e papel de quem escreveu.
const AUTHOR = "author:admin_users(name, role)";
const REPLY_COLUMNS = `id, body, created_at, ${AUTHOR}`;
const TICKET_COLUMNS = `id, title, description, area, priority, status, created_at, updated_at, resolved_at, ${AUTHOR}, replies:support_replies(${REPLY_COLUMNS})`;

const authorSchema = z.object({ name: z.string().nullable(), role: z.enum(["admin", "developer"]) }).nullable();

const replyRowSchema = z.object({
  id: z.string(),
  body: z.string(),
  created_at: z.string(),
  author: authorSchema,
});

const ticketRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  area: z.enum(SUPPORT_AREAS),
  priority: z.enum(SUPPORT_PRIORITIES),
  status: z.enum(SUPPORT_STATUSES),
  created_at: z.string(),
  updated_at: z.string(),
  resolved_at: z.string().nullable(),
  author: authorSchema,
  replies: z.array(replyRowSchema),
});

const toAuthor = (row: z.infer<typeof authorSchema>): SupportAuthor | null => (row ? { name: row.name, role: row.role } : null);

function toReply(raw: unknown): SupportReply {
  const row = replyRowSchema.parse(raw);
  return { id: row.id, body: row.body, author: toAuthor(row.author), createdAt: row.created_at };
}

function toTicket(raw: unknown): SupportTicket {
  const row = ticketRowSchema.parse(raw);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    area: row.area,
    priority: row.priority,
    status: row.status,
    author: toAuthor(row.author),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
    replies: row.replies.map(toReply).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  };
}

export class SupabaseSupportTicketRepository implements SupportTicketRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listAll(): Promise<SupportTicket[]> {
    const { data, error } = await this.client.from("support_tickets").select(TICKET_COLUMNS).order("updated_at", { ascending: false });
    if (error) fail(error);
    return data.map(toTicket);
  }

  async findById(id: string): Promise<SupportTicket | null> {
    const { data, error } = await this.client.from("support_tickets").select(TICKET_COLUMNS).eq("id", id).maybeSingle();
    if (error) fail(error);
    return data ? toTicket(data) : null;
  }

  async open(input: SupportTicketData): Promise<SupportTicket> {
    const { data, error } = await this.client.from("support_tickets").insert(input).select(TICKET_COLUMNS).single();
    if (error) fail(error);
    return toTicket(data);
  }

  async reply(ticketId: string, body: string): Promise<SupportReply> {
    const { data, error } = await this.client
      .from("support_replies")
      .insert({ ticket_id: ticketId, body })
      .select(REPLY_COLUMNS)
      .single();
    if (error) fail(error);
    return toReply(data);
  }

  async changeStatus(ticketId: string, status: SupportStatus): Promise<void> {
    const { data, error } = await this.client.from("support_tickets").update({ status }).eq("id", ticketId).select("id").maybeSingle();
    if (error) fail(error);
    if (!data) throw new SupportTicketNotFoundError();
  }
}
