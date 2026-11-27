import type { AuthService, StaffChatConnection, StaffChatListener, StaffChatRepository } from "@/application/ports";
import type { ChatReads, ChatRole, StaffChatMessage } from "@/domain/staff-chat";
import type { StickerId } from "@/domain/sticker";
import { newId, simulateLatency } from "./demo-database";

const STORAGE_KEY = "jota:demo-chat";

interface DemoChat {
  messages: StaffChatMessage[];
  reads: ChatReads;
}

function readChat(): DemoChat {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as DemoChat | null;
    return parsed ?? { messages: [], reads: {} };
  } catch (error) {
    console.error("Chat da demonstração ilegível; começando vazio.", error);
    return { messages: [], reads: {} };
  }
}

const writeChat = (chat: DemoChat) => window.localStorage.setItem(STORAGE_KEY, JSON.stringify(chat));

/** Demonstração sem servidor: as mensagens ficam no navegador e o "online" mostra só quem está nesta aba. */
export class DemoStaffChatRepository implements StaffChatRepository {
  constructor(private readonly auth: AuthService) {}

  async list(): Promise<{ messages: StaffChatMessage[]; reads: ChatReads }> {
    await simulateLatency();
    return structuredClone(readChat());
  }

  async send(body: string, sticker: StickerId | null): Promise<StaffChatMessage> {
    await simulateLatency();
    const author = await this.currentAuthor();
    const message: StaffChatMessage = { id: newId("chat"), body, sticker, author, createdAt: new Date().toISOString() };
    const chat = readChat();
    writeChat({ ...chat, messages: [...chat.messages, message] });
    return message;
  }

  async markRead(): Promise<void> {
    const { role } = await this.currentAuthor();
    const chat = readChat();
    writeChat({ ...chat, reads: { ...chat.reads, [role]: new Date().toISOString() } });
  }

  connect(role: ChatRole, listener: StaffChatListener): StaffChatConnection {
    listener.onPresence({ online: new Set([role]), typing: new Set() });
    return { typing: () => undefined, announceActivity: () => undefined, leave: () => undefined };
  }

  private async currentAuthor(): Promise<{ name: string | null; role: ChatRole; avatarUrl: string | null }> {
    const state = await this.auth.getState();
    if (state.status !== "signed-in") throw new Error("Entre no sistema para usar o chat.");
    const role: ChatRole = state.session.role === "developer" ? "developer" : "admin";
    return { name: state.session.name, role, avatarUrl: state.session.avatarUrl };
  }
}
