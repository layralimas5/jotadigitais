import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { StaffChatConnection, StaffChatListener, StaffChatRepository } from "@/application/ports";
import type { ChatReads, ChatRole, StaffChatMessage } from "@/domain/staff-chat";
import { stickerOf, type StickerId } from "@/domain/sticker";
import { fail } from "./supabase-repositories";

const CHANNEL = "staff-chat";
const HISTORY_LIMIT = 200;
/** Sem novo aviso de "digitando" nesse tempo, o outro lado para de mostrar. */
const TYPING_VISIBLE_MS = 4000;
const TYPING_THROTTLE_MS = 2000;

const roleSchema = z.enum(["admin", "developer"]);

const messageRowSchema = z.object({
  id: z.string(),
  body: z.string(),
  sticker: z.string().nullable(),
  created_at: z.string(),
  author: z.object({ name: z.string().nullable(), role: roleSchema, avatar_url: z.string().nullable() }).nullable(),
});

const readRowSchema = z.object({ last_read_at: z.string(), user: z.object({ role: z.string() }).nullable() });

const MESSAGE_COLUMNS = "id, body, sticker, created_at, author:admin_users(name, role, avatar_url)";

function toMessage(raw: unknown): StaffChatMessage {
  const row = messageRowSchema.parse(raw);
  return {
    id: row.id,
    body: row.body,
    sticker: stickerOf(row.sticker)?.id ?? null,
    author: row.author ? { name: row.author.name, role: row.author.role, avatarUrl: row.author.avatar_url } : null,
    createdAt: row.created_at,
  };
}

function toReads(rows: unknown[]): ChatReads {
  const reads: ChatReads = {};
  for (const raw of rows) {
    const row = readRowSchema.parse(raw);
    const role = roleSchema.safeParse(row.user?.role);
    if (role.success && (!reads[role.data] || row.last_read_at > (reads[role.data] ?? ""))) reads[role.data] = row.last_read_at;
  }
  return reads;
}

const presenceRoles = (channel: RealtimeChannel): Set<ChatRole> =>
  new Set(Object.keys(channel.presenceState()).flatMap((key) => (roleSchema.safeParse(key).success ? [key as ChatRole] : [])));

export class SupabaseStaffChatRepository implements StaffChatRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(): Promise<{ messages: StaffChatMessage[]; reads: ChatReads }> {
    const [messages, reads] = await Promise.all([
      this.client.from("staff_chat_messages").select(MESSAGE_COLUMNS).order("created_at", { ascending: false }).limit(HISTORY_LIMIT),
      this.client.from("staff_chat_reads").select("last_read_at, user:admin_users(role)"),
    ]);
    if (messages.error) fail(messages.error);
    if (reads.error) fail(reads.error);
    return { messages: messages.data.map(toMessage).reverse(), reads: toReads(reads.data) };
  }

  async send(body: string, sticker: StickerId | null): Promise<StaffChatMessage> {
    const { data, error } = await this.client.from("staff_chat_messages").insert({ body, sticker }).select(MESSAGE_COLUMNS).single();
    if (error) fail(error);
    return toMessage(data);
  }

  async markRead(): Promise<void> {
    const { error } = await this.client.rpc("mark_staff_chat_read");
    if (error) fail(error);
  }

  connect(role: ChatRole, listener: StaffChatListener): StaffChatConnection {
    const channel = this.client.channel(CHANNEL, { config: { private: true, presence: { key: role } } });
    const typing = new Set<ChatRole>();
    const timers = new Map<ChatRole, number>();
    let online = new Set<ChatRole>();
    let lastTypingSent = 0;

    const emit = () => listener.onPresence({ online, typing: new Set(typing) });
    const stopTyping = (who: ChatRole) => {
      typing.delete(who);
      window.clearTimeout(timers.get(who));
      timers.delete(who);
    };

    channel
      .on("presence", { event: "sync" }, () => {
        online = presenceRoles(channel);
        for (const who of typing) if (!online.has(who)) stopTyping(who);
        emit();
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const who = roleSchema.safeParse((payload as { role?: unknown }).role);
        if (!who.success || who.data === role) return;
        typing.add(who.data);
        window.clearTimeout(timers.get(who.data));
        timers.set(
          who.data,
          window.setTimeout(() => {
            stopTyping(who.data);
            emit();
          }, TYPING_VISIBLE_MS),
        );
        emit();
      })
      .on("broadcast", { event: "activity" }, ({ payload }) => {
        const who = roleSchema.safeParse((payload as { role?: unknown }).role);
        if (who.success && who.data !== role) {
          stopTyping(who.data);
          emit();
        }
        listener.onActivity();
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void channel.track({ role, at: new Date().toISOString() });
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") console.error(`Chat em tempo real: ${status}`);
      });

    return {
      typing: () => {
        const now = Date.now();
        if (now - lastTypingSent < TYPING_THROTTLE_MS) return;
        lastTypingSent = now;
        void channel.send({ type: "broadcast", event: "typing", payload: { role } });
      },
      announceActivity: () => void channel.send({ type: "broadcast", event: "activity", payload: { role } }),
      leave: () => {
        for (const who of [...typing]) stopTyping(who);
        void this.client.removeChannel(channel);
      },
    };
  }
}
