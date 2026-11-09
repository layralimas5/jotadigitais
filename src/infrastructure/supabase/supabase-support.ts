import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { SupportTicketRepository } from "@/application/ports";
import { SupportApprovalError, SupportLabelNameTakenError, SupportTicketNotFoundError } from "@/domain/errors";
import {
  SUPPORT_AREAS,
  SUPPORT_KINDS,
  SUPPORT_LABEL_COLORS,
  SUPPORT_PRIORITIES,
  SUPPORT_STATUSES,
  type SupportAttachment,
  type SupportAuthor,
  type SupportLabel,
  type SupportLabelData,
  type SupportNotifyEvent,
  type SupportStatusEvent,
  SUPPORT_OPENING_ID,
  type SupportReply,
  type SupportStatus,
  type SupportPriority,
  type SupportSubmitResult,
  type SupportTicket,
  type SupportTicketData,
  type SupportUpload,
} from "@/domain/support-ticket";
import { fail } from "./supabase-repositories";

const BUCKET = "support";
/** Tempo do link para ver o anexo. */
const SIGNED_URL_SECONDS = 60 * 60;
/** O link é reaproveitado até faltar isso para vencer: a conversa se atualiza sem reiniciar o vídeo que está tocando. */
const SIGNED_URL_MARGIN_MS = 10 * 60 * 1000;

const EXTENSION: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

// O autor vem de admin_users pela chave estrangeira: nome e papel de quem escreveu.
// No chamado a chave vai explícita: support_ticket_views também liga chamado e usuário.
const AUTHOR = "author:admin_users(name, role)";
const REPLY_COLUMNS = `id, body, created_at, reply_to_id, quotes_opening, ${AUTHOR}`;
const ATTACHMENT_COLUMNS = "id, reply_id, path, kind, name";
const EVENT_COLUMNS = `id, from_status, to_status, created_at, ${AUTHOR}`;
const VIEW_COLUMNS = "seen_at, viewer:admin_users(role)";
const TICKET_COLUMNS = `id, title, description, kind, area, priority, internal, status, label_id, created_at, updated_at, resolved_at, author:admin_users!support_tickets_created_by_fkey(name, role), replies:support_replies(${REPLY_COLUMNS}), attachments:support_attachments(${ATTACHMENT_COLUMNS}), events:support_status_events(${EVENT_COLUMNS}), views:support_ticket_views(${VIEW_COLUMNS})`;
const LABEL_COLUMNS = "id, name, color";
const UNIQUE_VIOLATION = "23505";

const authorSchema = z.object({ name: z.string().nullable(), role: z.enum(["admin", "developer"]) }).nullable();

const replyRowSchema = z.object({
  id: z.string(),
  body: z.string(),
  created_at: z.string(),
  reply_to_id: z.string().nullable(),
  quotes_opening: z.boolean(),
  author: authorSchema,
});

const attachmentRowSchema = z.object({
  id: z.string(),
  reply_id: z.string().nullable(),
  path: z.string(),
  kind: z.enum(["image", "video"]),
  name: z.string(),
});

const eventRowSchema = z.object({
  id: z.string(),
  from_status: z.enum(SUPPORT_STATUSES).nullable(),
  to_status: z.enum(SUPPORT_STATUSES),
  created_at: z.string(),
  author: authorSchema,
});

const viewRowSchema = z.object({ seen_at: z.string(), viewer: z.object({ role: z.enum(["admin", "developer"]) }).nullable() });

const labelRowSchema = z.object({ id: z.string(), name: z.string(), color: z.enum(SUPPORT_LABEL_COLORS) });

const toLabel = (raw: unknown): SupportLabel => labelRowSchema.parse(raw);

const ticketRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  kind: z.enum(SUPPORT_KINDS),
  area: z.enum(SUPPORT_AREAS),
  priority: z.enum(SUPPORT_PRIORITIES),
  internal: z.boolean(),
  status: z.enum(SUPPORT_STATUSES),
  label_id: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  resolved_at: z.string().nullable(),
  author: authorSchema,
  replies: z.array(replyRowSchema),
  attachments: z.array(attachmentRowSchema),
  events: z.array(eventRowSchema),
  views: z.array(viewRowSchema),
});

type AttachmentRow = z.infer<typeof attachmentRowSchema>;

const toAuthor = (row: z.infer<typeof authorSchema>): SupportAuthor | null => (row ? { name: row.name, role: row.role } : null);

function toReply(raw: unknown): SupportReply {
  const row = replyRowSchema.parse(raw);
  return {
    id: row.id,
    body: row.body,
    author: toAuthor(row.author),
    createdAt: row.created_at,
    replyToId: row.quotes_opening ? SUPPORT_OPENING_ID : row.reply_to_id,
  };
}

const toAttachment = (row: AttachmentRow, urls: ReadonlyMap<string, string>): SupportAttachment => ({
  id: row.id,
  kind: row.kind,
  name: row.name,
  url: urls.get(row.path) ?? null,
  replyId: row.reply_id,
});

function toTicket(raw: unknown, urls: ReadonlyMap<string, string> = new Map()): SupportTicket {
  const row = ticketRowSchema.parse(raw);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    kind: row.kind,
    area: row.area,
    priority: row.priority,
    internal: row.internal,
    status: row.status,
    author: toAuthor(row.author),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
    replies: row.replies.map(toReply).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    attachments: row.attachments.map((attachment) => toAttachment(attachment, urls)),
    labelId: row.label_id,
    events: row.events
      .map(
        (event): SupportStatusEvent => ({
          id: event.id,
          from: event.from_status,
          to: event.to_status,
          author: toAuthor(event.author),
          createdAt: event.created_at,
        }),
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    views: row.views.flatMap((view) => (view.viewer ? [{ role: view.viewer.role, seenAt: new Date(view.seen_at).toISOString() }] : [])),
  };
}

function failOnLabel(error: PostgrestError, name: string): never {
  if (error.code === UNIQUE_VIOLATION) throw new SupportLabelNameTakenError(name.trim());
  return fail(error);
}

export class SupabaseSupportTicketRepository implements SupportTicketRepository {
  private readonly urlCache = new Map<string, { url: string; expiresAt: number }>();

  constructor(private readonly client: SupabaseClient) {}

  async listAll(): Promise<SupportTicket[]> {
    const { data, error } = await this.client.from("support_tickets").select(TICKET_COLUMNS).order("updated_at", { ascending: false });
    if (error) fail(error);
    return data.map((row) => toTicket(row));
  }

  async findById(id: string): Promise<SupportTicket | null> {
    const { data, error } = await this.client.from("support_tickets").select(TICKET_COLUMNS).eq("id", id).maybeSingle();
    if (error) fail(error);
    if (!data) return null;
    const paths = ticketRowSchema.parse(data).attachments.map((attachment) => attachment.path);
    return toTicket(data, await this.signedUrls(paths));
  }

  async open(input: SupportTicketData, uploads: readonly SupportUpload[]): Promise<SupportSubmitResult<SupportTicket>> {
    const { data, error } = await this.client.from("support_tickets").insert(input).select(TICKET_COLUMNS).single();
    if (error) fail(error);
    const ticket = toTicket(data);
    return { saved: ticket, failedUploads: await this.attach(ticket.id, null, uploads) };
  }

  async reply(ticketId: string, body: string, uploads: readonly SupportUpload[], replyToId: string | null): Promise<SupportSubmitResult<SupportReply>> {
    const quotesOpening = replyToId === SUPPORT_OPENING_ID;
    const { data, error } = await this.client
      .from("support_replies")
      .insert({ ticket_id: ticketId, body, reply_to_id: quotesOpening ? null : replyToId, quotes_opening: quotesOpening })
      .select(REPLY_COLUMNS)
      .single();
    if (error) fail(error);
    const reply = toReply(data);
    return { saved: reply, failedUploads: await this.attach(ticketId, reply.id, uploads) };
  }

  async changeStatus(ticketId: string, status: SupportStatus): Promise<void> {
    const { data, error } = await this.client.from("support_tickets").update({ status }).eq("id", ticketId).select("id").maybeSingle();
    if (error) fail(error);
    if (!data) throw new SupportTicketNotFoundError();
  }

  async changePriority(ticketId: string, priority: SupportPriority): Promise<void> {
    const { error } = await this.client.rpc("set_support_ticket_priority", { p_ticket_id: ticketId, p_priority: priority });
    if (error) {
      if (error.message.includes("ticket_not_found")) throw new SupportTicketNotFoundError();
      fail(error);
    }
  }

  async markSeen(ticketId: string, notify: boolean): Promise<void> {
    const { error } = await this.client.rpc("mark_support_ticket_seen", { p_ticket_id: ticketId, p_notify: notify });
    if (error) fail(error);
  }

  async notifyAdmin(ticketId: string, event: SupportNotifyEvent): Promise<void> {
    const { error } = await this.client.rpc("notify_admin_support", { p_ticket_id: ticketId, p_event: event });
    if (error) fail(error);
  }

  async setInternal(ticketId: string, internal: boolean): Promise<void> {
    const { data, error } = await this.client.from("support_tickets").update({ internal }).eq("id", ticketId).select("id").maybeSingle();
    if (error) fail(error);
    if (!data) throw new SupportTicketNotFoundError();
  }

  async approve(ticketId: string): Promise<void> {
    const { error } = await this.client.rpc("approve_support_ticket", { p_ticket_id: ticketId });
    if (!error) return;
    if (error.code === "P0002") throw new SupportApprovalError("Este chamado não está mais aguardando você. Atualize a página.");
    fail(error);
  }

  async listLabels(): Promise<SupportLabel[]> {
    const { data, error } = await this.client.from("support_labels").select(LABEL_COLUMNS).order("created_at");
    if (error) fail(error);
    return data.map(toLabel);
  }

  async createLabel(input: SupportLabelData): Promise<SupportLabel> {
    const { data, error } = await this.client.from("support_labels").insert(input).select(LABEL_COLUMNS).single();
    if (error) failOnLabel(error, input.name);
    return toLabel(data);
  }

  async updateLabel(id: string, input: SupportLabelData): Promise<SupportLabel> {
    const { data, error } = await this.client.from("support_labels").update(input).eq("id", id).select(LABEL_COLUMNS).single();
    if (error) failOnLabel(error, input.name);
    return toLabel(data);
  }

  async removeLabel(id: string): Promise<void> {
    const { error } = await this.client.from("support_labels").delete().eq("id", id);
    if (error) fail(error);
  }

  async setLabel(ticketId: string, labelId: string | null): Promise<void> {
    const { data, error } = await this.client.from("support_tickets").update({ label_id: labelId }).eq("id", ticketId).select("id").maybeSingle();
    if (error) fail(error);
    if (!data) throw new SupportTicketNotFoundError();
  }

  async remove(ticketId: string): Promise<void> {
    // Os caminhos saem antes: depois do delete a linha dos anexos some junto (cascade).
    const { data: files, error: filesError } = await this.client.from("support_attachments").select("path").eq("ticket_id", ticketId);
    if (filesError) fail(filesError);
    const { data, error } = await this.client.from("support_tickets").delete().eq("id", ticketId).select("id").maybeSingle();
    if (error) fail(error);
    if (!data) throw new SupportTicketNotFoundError();
    const paths = files.map((file) => z.object({ path: z.string() }).parse(file).path);
    if (paths.length > 0) {
      const { error: storageError } = await this.client.storage.from(BUCKET).remove(paths);
      // O chamado já saiu; arquivo que sobrar no bucket não aparece em lugar nenhum.
      if (storageError) console.error("Falha ao apagar anexos do chamado", storageError);
    }
  }

  /** Sobe um arquivo por vez e registra no chamado. Devolve o nome dos que falharam. */
  private async attach(ticketId: string, replyId: string | null, uploads: readonly SupportUpload[]): Promise<string[]> {
    const failed: string[] = [];
    for (const upload of uploads) {
      const path = `${ticketId}/${crypto.randomUUID()}.${EXTENSION[upload.contentType] ?? "bin"}`;
      const stored = await this.client.storage.from(BUCKET).upload(path, upload.file, { contentType: upload.contentType });
      if (stored.error) {
        console.error("Falha ao subir anexo do suporte", stored.error);
        failed.push(upload.name);
        continue;
      }
      const { error } = await this.client.from("support_attachments").insert({
        ticket_id: ticketId,
        reply_id: replyId,
        path,
        kind: upload.kind,
        name: upload.name.slice(0, 200),
        content_type: upload.contentType,
        size_bytes: upload.file.size,
      });
      if (error) {
        console.error("Falha ao registrar anexo do suporte", error);
        failed.push(upload.name);
      }
    }
    return failed;
  }

  private async signedUrls(paths: string[]): Promise<Map<string, string>> {
    const now = Date.now();
    const missing = paths.filter((path) => (this.urlCache.get(path)?.expiresAt ?? 0) - SIGNED_URL_MARGIN_MS <= now);
    if (missing.length > 0) {
      const { data, error } = await this.client.storage.from(BUCKET).createSignedUrls(missing, SIGNED_URL_SECONDS);
      if (error) {
        // Sem link o anexo aparece como indisponível, mas a conversa continua legível.
        console.error("Falha ao gerar links dos anexos do suporte", error);
      } else {
        const expiresAt = now + SIGNED_URL_SECONDS * 1000;
        for (const item of data) if (item.path && item.signedUrl) this.urlCache.set(item.path, { url: item.signedUrl, expiresAt });
      }
    }
    return new Map(paths.flatMap((path) => {
      const cached = this.urlCache.get(path);
      return cached ? [[path, cached.url] as const] : [];
    }));
  }
}
