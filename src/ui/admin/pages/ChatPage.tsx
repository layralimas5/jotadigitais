import { CheckCheck, Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { listStaffChat, markStaffChatRead, sendStaffChatMessage } from "@/application/chat-use-cases";
import type { StaffChatConnection } from "@/application/ports";
import {
  CHAT_ROLE_NAME,
  CHAT_TEXT_MAX,
  otherChatRole,
  seenByOther,
  type ChatPresence,
  type ChatReads,
  type ChatRole,
  type StaffChatMessage,
} from "@/domain/staff-chat";
import { stickerMessageBody, stickerOf, type Sticker } from "@/domain/sticker";
import { Button } from "@/ui/components/Button";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { cn } from "@/ui/lib/cn";
import { useAdminView } from "../admin-view";
import { LoadingBlock, PageHeader } from "../components/AdminUi";
import { ConversationExtras, StickerImage } from "../components/ConversationExtras";
import { PersonAvatar } from "../components/PersonAvatar";
import { useAdminQuery, useMutation, usePolling } from "../hooks";
import { formatDate, formatRelative } from "../lib/dates";
import { useAdminRole } from "../session";

/** Reserva: se o tempo real cair, a conversa ainda se atualiza sozinha. */
const FALLBACK_REFRESH_MS = 30_000;

const NO_PRESENCE: ChatPresence = { online: new Set(), typing: new Set() };

const chatRoleOf = (role: string | null): ChatRole | null => (role === "admin" || role === "developer" ? role : null);

interface ChatData {
  messages: StaffChatMessage[];
  reads: ChatReads;
}

/** Entra no canal em tempo real enquanto a tela está aberta: é isso que faz o outro lado ver "online". */
function useChatConnection(role: ChatRole | null, onActivity: () => void) {
  const { deps } = useAdminView();
  const [presence, setPresence] = useState<ChatPresence>(NO_PRESENCE);
  const connection = useRef<StaffChatConnection | null>(null);
  const activityRef = useRef(onActivity);
  useEffect(() => {
    activityRef.current = onActivity;
  });

  useEffect(() => {
    if (!role) return;
    const current = deps.chat.connect(role, { onPresence: setPresence, onActivity: () => activityRef.current() });
    connection.current = current;
    return () => {
      current.leave();
      connection.current = null;
    };
  }, [deps, role]);

  return { presence, connection };
}

function StatusLine({ other, presence, reads }: { other: ChatRole; presence: ChatPresence; reads: ChatReads }) {
  if (presence.typing.has(other)) return <span className="text-electric">digitando…</span>;
  if (presence.online.has(other))
    return (
      <span className="inline-flex items-center gap-1.5 text-emerald-300">
        <span aria-hidden className="size-2 rounded-full bg-emerald-400" /> online no chat
      </span>
    );
  const lastRead = reads[other];
  return <span className="text-mist">{lastRead ? `viu o chat ${formatRelative(lastRead)}` : "ainda não abriu o chat"}</span>;
}

function ChatBubble({ message, own, seen }: { message: StaffChatMessage; own: boolean; seen: boolean }) {
  const sticker = stickerOf(message.sticker);
  return (
    <li className={cn("flex flex-col", own ? "items-end" : "items-start")}>
      {sticker ? (
        <StickerImage sticker={sticker} />
      ) : (
        <p
          className={cn(
            "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap sm:max-w-[70%]",
            own ? "rounded-br-md bg-electric/20 text-white" : "rounded-bl-md border border-line bg-surface text-fog",
          )}
        >
          {message.body}
        </p>
      )}
      <span className="mt-1 inline-flex items-center gap-1 px-1 text-[0.7rem] text-mist">
        <time dateTime={message.createdAt} title={formatDate(message.createdAt)}>
          {formatRelative(message.createdAt)}
        </time>
        {own && seen && (
          <span className="inline-flex items-center gap-0.5 text-electric">
            <CheckCheck aria-hidden className="size-3.5" /> visto
          </span>
        )}
      </span>
    </li>
  );
}

interface ComposerProps {
  sending: boolean;
  error: string | null;
  onSend: (body: string, sticker: Sticker | null) => Promise<boolean>;
  onTyping: () => void;
}

function Composer({ sending, error, onSend, onTyping }: ComposerProps) {
  const [body, setBody] = useState("");
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  const insertEmoji = (emoji: string) => {
    const field = fieldRef.current;
    const start = field?.selectionStart ?? body.length;
    const end = field?.selectionEnd ?? body.length;
    setBody(`${body.slice(0, start)}${emoji}${body.slice(end)}`);
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  const submit = async () => {
    if (!body.trim() || sending) return;
    if (await onSend(body, null)) setBody("");
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit();
  };

  // Enter envia, Shift+Enter quebra a linha (como no WhatsApp Web).
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <form onSubmit={onSubmit} aria-busy={sending} className="space-y-3 rounded-3xl border border-line bg-surface/60 p-3 sm:p-4">
      <div className="flex items-end gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Mensagem</span>
          <textarea
            ref={fieldRef}
            rows={1}
            maxLength={CHAT_TEXT_MAX}
            value={body}
            placeholder="Escreva uma mensagem"
            onChange={(event) => {
              setBody(event.target.value);
              onTyping();
            }}
            onKeyDown={onKeyDown}
            className="max-h-40 min-h-11 w-full resize-y rounded-2xl border border-line-strong bg-ink px-4 py-2.5 text-base text-white placeholder:text-mist focus:border-electric focus:outline-none sm:text-sm"
          />
        </label>
        <Button type="submit" disabled={sending || !body.trim()} aria-label="Enviar mensagem" className="size-11 shrink-0 px-0">
          <Send aria-hidden className="size-4" />
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-alert">
          {error}
        </p>
      )}
      <ConversationExtras onEmoji={insertEmoji} onSticker={(sticker) => void onSend(stickerMessageBody(sticker), sticker)} disabled={sending} />
    </form>
  );
}

/** Chat da Lay com o Jota: tempo real, "online" só com o chat aberto, figurinhas e visto. */
export default function ChatPage() {
  const role = chatRoleOf(useAdminRole());
  const { mode } = useAdminView();
  const ownView = mode === "self";

  if (!role) return <EmptyState title="Chat só da Layra e do Jota" description="Este chat é a conversa direta entre a desenvolvedora e o dono da loja." />;
  if (!ownView)
    return <EmptyState title="Chat fora do “Ver como”" description="Volte para o seu painel para conversar: no “Ver como”, o chat não aparece para não misturar quem está online." />;
  return <ChatScreen role={role} />;
}

function ChatScreen({ role }: { role: ChatRole }) {
  const chat = useAdminQuery(listStaffChat, "staff-chat");
  const { run: markRead } = useMutation(markStaffChatRead);
  const send = useMutation(sendStaffChatMessage);
  const sendMessage = send.run;
  const markedFor = useRef<string | null>(null);
  const other = otherChatRole(role);
  const listEnd = useRef<HTMLDivElement>(null);
  const data: ChatData | null = chat.status === "success" ? chat.data : null;
  const reload = chat.reload;

  const { presence, connection } = useChatConnection(role, reload);
  usePolling(reload, FALLBACK_REFRESH_MS);

  const lastMessageId = data?.messages.at(-1)?.id ?? null;
  const lastOtherMessage = data?.messages.filter((message) => message.author?.role === other).at(-1)?.createdAt ?? null;
  const myLastRead = data?.reads[role] ?? null;

  // Chegou mensagem do outro que eu ainda não li, com a tela aberta: marca como lida e avisa o outro lado (visto).
  useEffect(() => {
    if (!lastOtherMessage || (myLastRead && myLastRead >= lastOtherMessage) || document.visibilityState !== "visible") return;
    if (markedFor.current === lastOtherMessage) return;
    markedFor.current = lastOtherMessage;
    void markRead().then(() => {
      connection.current?.announceActivity();
      reload();
    });
  }, [lastOtherMessage, myLastRead, markRead, connection, reload]);

  useEffect(() => {
    listEnd.current?.scrollIntoView({ block: "end" });
  }, [lastMessageId]);

  const onSend = useCallback(
    async (body: string, sticker: Sticker | null) => {
      const saved = await sendMessage({ body, sticker: sticker?.id ?? null });
      if (!saved) return false;
      connection.current?.announceActivity();
      reload();
      return true;
    },
    [sendMessage, connection, reload],
  );

  const otherAuthor = data?.messages.find((message) => message.author?.role === other)?.author ?? null;
  const lastOwn = data?.messages.filter((message) => message.author?.role === role).at(-1) ?? null;

  return (
    <div className="space-y-4">
      <PageHeader title="Chat" description={`Conversa direta com ${role === "developer" ? "o Jota" : "a Layra"}. Online aparece só com o chat aberto.`} />
      <section aria-label={`Conversa com ${CHAT_ROLE_NAME[other]}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface/60 p-3">
        <PersonAvatar name={otherAuthor?.name ?? CHAT_ROLE_NAME[other]} src={otherAuthor?.avatarUrl} />
        <div className="min-w-0">
          <p className="font-semibold text-white">{otherAuthor?.name ?? CHAT_ROLE_NAME[other]}</p>
          <p aria-live="polite" className="text-xs">
            <StatusLine other={other} presence={presence} reads={data?.reads ?? {}} />
          </p>
        </div>
      </section>

      {chat.status === "loading" && <LoadingBlock />}
      {chat.status === "error" && <ErrorState message={chat.error.message} onRetry={reload} />}
      {data && (
        <div className="max-h-[60dvh] min-h-64 overflow-y-auto rounded-3xl border border-line bg-ink/60 p-3 sm:p-5">
          {data.messages.length === 0 ? (
            <p className="py-16 text-center text-sm text-mist">Nenhuma mensagem ainda. Manda um oi (ou uma figurinha).</p>
          ) : (
            <ol aria-label="Mensagens" className="space-y-3">
              {data.messages.map((message) => {
                const own = message.author?.role === role;
                return <ChatBubble key={message.id} message={message} own={own} seen={own && message.id === lastOwn?.id && seenByOther(message, role, data.reads)} />;
              })}
            </ol>
          )}
          <div ref={listEnd} />
        </div>
      )}

      <Composer sending={send.pending} error={send.error?.message ?? null} onSend={onSend} onTyping={() => connection.current?.typing()} />
    </div>
  );
}
