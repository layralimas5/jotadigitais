import { z } from "zod";
import { CHAT_TEXT_MAX, type ChatReads, type StaffChatMessage } from "@/domain/staff-chat";
import { STICKER_IDS } from "@/domain/sticker";
import type { AdminDeps } from "./admin-use-cases";
import { parseOrThrow } from "./schemas";

const chatMessageSchema = z.object({
  body: z.string().trim().min(1, "Escreva a mensagem.").max(CHAT_TEXT_MAX, `Use no máximo ${CHAT_TEXT_MAX} caracteres.`),
  sticker: z.enum(STICKER_IDS).nullable().default(null),
});

export function listStaffChat(deps: AdminDeps): Promise<{ messages: StaffChatMessage[]; reads: ChatReads }> {
  return deps.chat.list();
}

export function sendStaffChatMessage(deps: AdminDeps, raw: unknown): Promise<StaffChatMessage> {
  const { body, sticker } = parseOrThrow(chatMessageSchema, raw);
  return deps.chat.send(body, sticker);
}

export function markStaffChatRead(deps: AdminDeps): Promise<void> {
  return deps.chat.markRead();
}
