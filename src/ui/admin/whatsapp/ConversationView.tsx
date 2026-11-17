import { ArrowLeft, Bot, ExternalLink, GraduationCap, SendHorizontal, UserRound } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import {
  listWhatsAppChat,
  markWhatsAppRead,
  sendWhatsAppReply,
  setWhatsAppContactKind,
  setWhatsAppHandler,
} from "@/application/admin-use-cases";
import {
  CONTACT_KINDS,
  CONTACT_KIND_LABEL,
  windowOpen,
  type WhatsAppChatMessage,
  type WhatsAppContact,
  type WhatsAppContactKind,
  type WhatsAppMode,
} from "@/domain/whatsapp";
import { Button } from "@/ui/components/Button";
import { ErrorState } from "@/ui/components/StateViews";
import { InlineError, LoadingBlock } from "../components/AdminUi";
import { useAdminQuery, useMutation, usePolling } from "../hooks";
import { formatPhone, whatsappChatUrl } from "../lib/whatsapp";
import { useToast } from "../toast";
import { ChatBubble } from "./ChatBubble";
import { teachLink } from "./links";

const REFRESH_MS = 8_000;

/** A última mensagem do cliente antes de uma resposta do Jota: vira a pergunta ao ensinar a IA. */
function questionBefore(messages: readonly WhatsAppChatMessage[], index: number): string {
  for (let i = index - 1; i >= 0; i -= 1) {
    if (messages[i]!.author === "customer") return messages[i]!.body;
  }
  return "";
}

function StatusBadge({ message }: { message: WhatsAppChatMessage }) {
  if (message.status === "test") return <span className="rounded-full border border-amber-300/40 px-1.5 text-amber-200">Teste</span>;
  if (message.status === "failed")
    return (
      <span title={message.error ?? undefined} className="rounded-full border border-alert/50 px-1.5 text-[#ff7a7a]">
        Não enviada
      </span>
    );
  return null;
}

function Composer({ contact, mode, onSent }: { contact: WhatsAppContact; mode: WhatsAppMode; onSent: () => void }) {
  const toast = useToast();
  const [text, setText] = useState("");
  const send = useMutation(sendWhatsAppReply);
  const id = useId();
  const closed = mode === "live" && !windowOpen(contact);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || send.pending) return;
    const ok = await send.run(contact.id, trimmed);
    if (ok === undefined) return;
    setText("");
    onSent();
    if (contact.handler === "ai") toast.show("Você assumiu a conversa. A IA para de responder até você devolver.");
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit();
  };
  // Enter envia; Shift+Enter quebra a linha, como no WhatsApp Web.
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    }
  };

  if (closed) {
    return (
      <p className="rounded-2xl border border-line bg-ink/60 p-3 text-xs leading-relaxed text-mist">
        Já passaram 24h da última mensagem deste cliente. O WhatsApp só libera responder quando ele escrever de novo.{" "}
        <a href={whatsappChatUrl(contact.phone)} target="_blank" rel="noreferrer" className="text-electric-soft underline">
          Abrir no WhatsApp do celular
        </a>
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      {send.error && <InlineError message={send.error.message} />}
      <div className="flex items-end gap-2">
        <label htmlFor={id} className="sr-only">
          Sua resposta
        </label>
        <textarea
          id={id}
          rows={2}
          value={text}
          maxLength={4096}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={mode === "test" ? "Responder (modo teste: fica registrado, não sai)…" : "Responder…"}
          className="max-h-40 min-h-11 min-w-0 flex-1 resize-y rounded-2xl border border-line-strong bg-ink px-4 py-2.5 text-sm text-white placeholder:text-mist/70 focus:border-electric focus:outline-none"
        />
        <Button type="submit" disabled={!text.trim() || send.pending} aria-label="Enviar resposta" className="size-11 shrink-0 px-0">
          <SendHorizontal aria-hidden className="size-4" />
        </Button>
      </div>
    </form>
  );
}

interface ConversationViewProps {
  contact: WhatsAppContact;
  mode: WhatsAppMode;
  onChanged: () => void;
  onBack: () => void;
}

export function ConversationView({ contact, mode, onChanged, onBack }: ConversationViewProps) {
  const toast = useToast();
  const chat = useAdminQuery((deps) => listWhatsAppChat(deps, contact.id), `whatsapp-chat-${contact.id}`);
  const handler = useMutation(setWhatsAppHandler);
  const kind = useMutation(setWhatsAppContactKind);
  const markRead = useMutation(markWhatsAppRead);
  const endRef = useRef<HTMLLIElement>(null);

  const reloadVisible = useCallback(() => {
    if (document.visibilityState === "visible") chat.reload();
  }, [chat.reload]);
  usePolling(reloadVisible, REFRESH_MS);

  // Abrir a conversa conta como lida.
  const unread = contact.unreadCount;
  const markReadRun = markRead.run;
  useEffect(() => {
    if (unread === 0) return;
    void markReadRun(contact.id).then((done) => done !== undefined && onChanged());
  }, [contact.id, unread, markReadRun, onChanged]);

  const messages = chat.status === "success" ? chat.data : null;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages?.length, contact.id]);

  const toggleHandler = async () => {
    const next = contact.handler === "ai" ? "staff" : "ai";
    const done = await handler.run(contact.id, next);
    if (done === undefined) {
      toast.show("Não foi possível mudar quem atende.", "error");
      return;
    }
    onChanged();
    toast.show(next === "staff" ? "Conversa com você. A IA não responde mais este cliente." : "Conversa devolvida para a IA.");
  };

  const changeKind = async (value: WhatsAppContactKind) => {
    const done = await kind.run(contact.id, value);
    if (done === undefined) toast.show("Não foi possível mudar o tipo do contato.", "error");
    else onChanged();
  };

  const refresh = () => {
    chat.reload();
    onChanged();
  };

  const title = contact.name ?? formatPhone(contact.phone);

  return (
    <section aria-label={`Conversa com ${title}`} className="flex min-h-0 flex-col rounded-3xl border border-line bg-surface/60">
      <header className="flex flex-wrap items-center gap-3 border-b border-line p-4">
        <Button type="button" variant="ghost" onClick={onBack} aria-label="Voltar para a lista" className="size-10 px-0 md:hidden">
          <ArrowLeft aria-hidden className="size-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-base font-semibold text-white">{title}</h2>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-mist">
            <span>{formatPhone(contact.phone)}</span>
            <a href={whatsappChatUrl(contact.phone)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-white">
              <ExternalLink aria-hidden className="size-3" /> WhatsApp do celular
            </a>
          </p>
        </div>
        <label className="sr-only" htmlFor={`kind-${contact.id}`}>
          Tipo do contato
        </label>
        <select
          id={`kind-${contact.id}`}
          value={contact.kind}
          disabled={kind.pending}
          onChange={(event) => void changeKind(event.target.value as WhatsAppContactKind)}
          className="h-10 rounded-xl border border-line-strong bg-ink px-3 text-sm text-white [color-scheme:dark] focus:border-electric focus:outline-none"
        >
          {CONTACT_KINDS.map((value) => (
            <option key={value} value={value}>
              {CONTACT_KIND_LABEL[value]}
            </option>
          ))}
        </select>
        <Button type="button" variant={contact.handler === "ai" ? "primary" : "secondary"} disabled={handler.pending} onClick={() => void toggleHandler()}>
          {contact.handler === "ai" ? (
            <>
              <UserRound aria-hidden className="size-4" /> Assumir
            </>
          ) : (
            <>
              <Bot aria-hidden className="size-4" /> Devolver para a IA
            </>
          )}
        </Button>
      </header>

      {contact.handler === "staff" && contact.handoffSummary && (
        <div className="mx-4 mt-4 rounded-2xl border border-pink/30 bg-pink/[0.06] p-3 text-sm">
          <p className="text-xs font-semibold text-pink">A IA passou para você</p>
          <p className="mt-1 leading-relaxed text-fog">{contact.handoffSummary}</p>
        </div>
      )}
      {contact.optedOut && (
        <p className="mx-4 mt-4 rounded-2xl border border-line bg-ink/60 p-3 text-xs text-mist">
          Este cliente pediu para parar as mensagens automáticas. A IA não responde; você ainda pode responder pelo painel.
        </p>
      )}

      <div className="min-h-72 flex-1 overflow-y-auto bg-[#0b141a] p-4 md:max-h-[calc(100dvh-26rem)]">
        {chat.status === "loading" && <LoadingBlock />}
        {chat.status === "error" && <ErrorState message={chat.error.message} onRetry={chat.reload} />}
        {messages && (
          <ol aria-live="polite" className="space-y-3">
            {messages.map((message, index) => (
              <ChatBubble
                key={message.id}
                author={message.author}
                body={message.body}
                at={message.createdAt}
                badge={<StatusBadge message={message} />}
                footer={
                  message.author === "staff" && (
                    <Link
                      to={teachLink(questionBefore(messages, index), message.body)}
                      className="inline-flex items-center gap-1 px-1 text-[0.7rem] font-medium text-electric-soft hover:text-white"
                    >
                      <GraduationCap aria-hidden className="size-3.5" /> Ensinar essa resposta para a IA
                    </Link>
                  )
                }
              />
            ))}
            <li ref={endRef} aria-hidden />
          </ol>
        )}
      </div>

      <div className="border-t border-line p-4">
        <Composer contact={contact} mode={mode} onSent={refresh} />
      </div>
    </section>
  );
}
