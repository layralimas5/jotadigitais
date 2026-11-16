import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { AdminWhatsAppRepository } from "@/application/ports";
import type { WhatsAppMessage, WhatsAppSettings } from "@/domain/whatsapp";
import { fail } from "./supabase-repositories";

const settingsRowSchema = z.object({ auto_delivery: z.boolean(), mode: z.enum(["test", "live"]) });

const toSettings = (raw: unknown): WhatsAppSettings => {
  const row = settingsRowSchema.parse(raw);
  return { autoDelivery: row.auto_delivery, mode: row.mode };
};

const MESSAGE_COLUMNS = "id, kind, status, to_phone, body, error, created_at, sent_at, order:orders(code, customer_name)";

const messageRowSchema = z.object({
  id: z.string(),
  kind: z.enum(["payment_confirmed", "delivery"]),
  status: z.enum(["queued", "sending", "test", "sent", "failed"]),
  to_phone: z.string(),
  body: z.string().nullable(),
  error: z.string().nullable(),
  created_at: z.string(),
  sent_at: z.string().nullable(),
  order: z.object({ code: z.string(), customer_name: z.string() }).nullable(),
});

function toMessage(raw: unknown): WhatsAppMessage {
  const row = messageRowSchema.parse(raw);
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    toPhone: row.to_phone,
    body: row.body,
    error: row.error,
    orderCode: row.order?.code ?? null,
    customerName: row.order?.customer_name ?? null,
    createdAt: row.created_at,
    sentAt: row.sent_at,
  };
}

export class SupabaseWhatsAppRepository implements AdminWhatsAppRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getSettings(): Promise<WhatsAppSettings> {
    const { data, error } = await this.client.from("whatsapp_settings").select("auto_delivery, mode").single();
    if (error) fail(error);
    return toSettings(data);
  }

  async setAutoDelivery(enabled: boolean): Promise<WhatsAppSettings> {
    const { data, error } = await this.client
      .from("whatsapp_settings")
      .update({ auto_delivery: enabled })
      .eq("id", true)
      .select("auto_delivery, mode")
      .single();
    if (error) fail(error);
    return toSettings(data);
  }

  async listMessages(limit: number): Promise<WhatsAppMessage[]> {
    const { data, error } = await this.client
      .from("whatsapp_messages")
      .select(MESSAGE_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) fail(error);
    return data.map(toMessage);
  }
}
