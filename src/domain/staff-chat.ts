import type { StickerId } from "./sticker";

/** Quem conversa no chat: a desenvolvedora (Lay) e o admin (Jota). */
export type ChatRole = "admin" | "developer";

export interface ChatAuthor {
  name: string | null;
  role: ChatRole;
  avatarUrl: string | null;
}

export interface StaffChatMessage {
  id: string;
  body: string;
  sticker: StickerId | null;
  /** Nulo quando o usuário foi removido do sistema. */
  author: ChatAuthor | null;
  createdAt: string;
}

/** Última leitura de cada lado: dá o "visto" e as não lidas. */
export type ChatReads = Partial<Record<ChatRole, string>>;

/** Quem está com o chat aberto agora e quem está digitando (vem do Realtime, não do banco). */
export interface ChatPresence {
  online: ReadonlySet<ChatRole>;
  typing: ReadonlySet<ChatRole>;
}

export const CHAT_TEXT_MAX = 4000;

export const otherChatRole = (role: ChatRole): ChatRole => (role === "developer" ? "admin" : "developer");

export const CHAT_ROLE_NAME: Record<ChatRole, string> = { developer: "Layra", admin: "Jota" };

/** Mensagens do outro lado que chegaram depois da minha última leitura. */
export function unreadChatCount(messages: readonly StaffChatMessage[], role: ChatRole, reads: ChatReads): number {
  const lastRead = reads[role];
  return messages.filter((message) => message.author?.role !== role && (!lastRead || message.createdAt > lastRead)).length;
}

/** A minha mensagem já foi vista pelo outro lado? */
export const seenByOther = (message: StaffChatMessage, role: ChatRole, reads: ChatReads): boolean => {
  const otherRead = reads[otherChatRole(role)];
  return Boolean(otherRead && otherRead >= message.createdAt);
};
