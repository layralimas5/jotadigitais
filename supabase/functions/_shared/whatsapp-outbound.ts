// O que a loja manda na conversa (IA, Jota, avisos e entrega do acesso) e os avisos para o Jota no sininho/push.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.117.3";
import { CloudSendError, sendCloudOptions, sendCloudText } from "./whatsapp-cloud.ts";
import { renderWithOptions } from "./whatsapp-flow.ts";

export type OutboundStatus = "test" | "sent" | "failed";

export interface OutboundResult {
  status: OutboundStatus;
  error: string | null;
  waMessageId: string | null;
}

export interface OutboundExtras {
  /** Pergunta de fluxo: sai como botões ou lista; na conversa fica o texto com as opções numeradas. */
  options?: readonly string[];
  /** O que fica no histórico quando difere do enviado (a entrega guarda as senhas mascaradas). */
  recordedBody?: string;
}

/** Envia (modo live) ou só registra (modo teste) uma mensagem da loja na conversa. */
export async function recordOutbound(
  admin: SupabaseClient,
  contactId: string,
  phone: string,
  author: "ai" | "staff" | "system",
  body: string,
  mode: "test" | "live",
  { options = [], recordedBody }: OutboundExtras = {},
): Promise<OutboundResult> {
  let status: OutboundStatus = "test";
  let waMessageId: string | null = null;
  let error: string | null = null;
  if (mode === "live") {
    try {
      waMessageId = options.length > 0 ? await sendCloudOptions(phone, body, options) : await sendCloudText(phone, body);
      status = "sent";
    } catch (reason) {
      if (!(reason instanceof CloudSendError)) throw reason;
      status = "failed";
      error = reason.message;
    }
  }
  const recorded = renderWithOptions(recordedBody ?? body, options);
  const { error: insertError } = await admin
    .from("whatsapp_chat")
    .insert({ contact_id: contactId, direction: "out", author, body: recorded, status, error, wa_message_id: waMessageId });
  if (insertError) throw insertError;
  const { error: updateError } = await admin
    .from("whatsapp_contacts")
    // Respondida pela loja (IA, Jota ou aviso automático): sai da contagem de "esperando você".
    .update({ last_message_at: new Date().toISOString(), last_message_preview: recorded.slice(0, 160), unread_count: 0 })
    .eq("id", contactId);
  if (updateError) throw updateError;
  return { status, error, waMessageId };
}

/** Aviso no sininho e no celular do Jota (kind whatsapp). É extra: falhar aqui não impede a resposta ao cliente. */
export async function notify(admin: SupabaseClient, link: string, title: string, body: string) {
  const { error } = await admin.from("notifications").insert({
    kind: "whatsapp",
    title: title.slice(0, 120),
    body: body.slice(0, 500) || null,
    link,
  });
  if (error) console.error("whatsapp notify", error);
}

export const conversationLink = (contactId: string) => `/admin/whatsapp?c=${contactId}`;

/** Passa a conversa para o Jota e avisa no celular. */
export async function handOff(admin: SupabaseClient, contactId: string, name: string | null, summary: string) {
  const { error } = await admin.from("whatsapp_contacts").update({ handler: "staff", handoff_summary: summary.slice(0, 1000), unread_count: 1 }).eq("id", contactId);
  if (error) throw error;
  await notify(admin, conversationLink(contactId), `${name ?? "Cliente"} está esperando você no WhatsApp`, summary);
}
