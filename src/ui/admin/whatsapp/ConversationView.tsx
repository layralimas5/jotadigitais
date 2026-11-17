import { ArrowLeft, ArrowUp, ExternalLink, GraduationCap } from "lucide-react";
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
  type WhatsAppHandler,
  type WhatsAppMode,
} from "@/domain/whatsapp";
import { ErrorState } from "@/ui/components/StateViews";
import { cn } from "@/ui/lib/cn";
import { InlineError, LoadingBlock } from "../components/AdminUi";
import { useAdminQuery, useMutation, usePolling } from "../hooks";
import { formatPhone, whatsappChatUrl } from "../lib/whatsapp";
import { useToast } from "../toast";
import { ChatBubble } from "./ChatBubble";
import { ContactAvatar } from "./ContactAvatar";
import { teachLink } from "./links";
import { compactButton } from "./styles";

const REFRESH_MS = 8_000;
const MAX_COMPOSER_PX = 160;

/** A última mensagem do cliente antes de uma resposta do Jota: vira a pergunta ao ensinar a IA. */
function questionBefore(messages: readonly WhatsAppChatMessage[], index: number): string {
  for (let i = index - 1; i >= 0; i -= 1) {
    if (messages[i]!.author === "customer") return messages[i]!.body;
  }
  return "";
}

function FailedBadge({ message }: { message: WhatsAppChatMessage }) {
  if (message.status !== "failed") return null;
  return (
    <span title={message.error ?? undefined} className="font-medium text-[#ff7a7a]">
      Não enviada
    </span>
  );
}

function Composer({ contact, mode, onSent }: { contact: WhatsAppContact; mode: WhatsAppMode; onSent: () => void }) {
  const toast = useToast();
  const [text, setText] = useState("");
  const send = useMutation(async (deps, contactId: string, body: string) => {
    await sendWhatsAppReply(deps, contactId, body);
    return true;
  });
  const id = useId();
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const closed = mode === "live" && !windowOpen(contact);

  // Cresce com o texto até um limite, como nos apps de mensagem.
  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, MAX_COMPOSER_PX)}px`;
  }, [text]);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || send.pending) return;
    if (!(await send.run(contact.id, trimmed))) return;
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
      <p className="text-xs leading-relaxed text-mist">
        Já passaram 24h da última mensagem deste cliente. O WhatsApp só libera responder quando ele escrever de novo.{" "}
        <a href={whatsappChatUrl(contact.phone)} target="_blank" rel="noreferrer" className="text-fog underline underline-offset-2 hover:text-white">
          Abrir no WhatsApp do celular
        </a>
      </p>
    );
  }

  const canSend = text.trim().length > 0 && !send.pending;
  return (
    <form onSubmit={onSubmit} className="space-y-2">
      {send.error && <InlineError message={send.error.message} />}
      <div className="flex items-end gap-2 rounded-xl border border-line-strong bg-night py-1.5 pr-1.5 pl-3.5 transition-colors focus-within:border-white/25">
        <label htmlFor={id} className="sr-only">
          Sua resposta
        </label>
        <textarea
          ref={fieldRef}
          id={id}
          rows={1}
          value={text}
          maxLength={4096}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Escreva uma resposta"
          className="min-w-0 flex-1 resize-none bg-transparent py-1.5 text-sm text-white placeholder:text-mist/70 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Enviar resposta"
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric",
            canSend ? "bg-white text-ink hover:bg-fog" : "bg-white/[0.06] text-mist",
          )}
        >
          <ArrowUp aria-hidden className="size-4" />
        </button>
      </div>
      <p className="px-1 text-[0.7rem] text-mist">
        {mode === "test" ? "Modo teste: a resposta fica registrada aqui e não chega ao cliente." : "Enter envia, Shift + Enter quebra a linha."}
      </p>
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
  // As ações não devolvem nada: o "true" diferencia sucesso de falha (o hook devolve undefined no erro).
  const handler = useMutation(async (deps, contactId: string, next: WhatsAppHandler) => {
    await setWhatsAppHandler(deps, contactId, next);
    return true;
  });
  const kind = useMutation(async (deps, contactId: string, next: WhatsAppContactKind) => {
    await setWhatsAppContactKind(deps, contactId, next);
    return true;
  });
  const markRead = useMutation(async (deps, contactId: string) => {
    await markWhatsAppRead(deps, contactId);
    return true;
  });
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
    void markReadRun(contact.id).then((done) => done && onChanged());
  }, [contact.id, unread, markReadRun, onChanged]);

  const messages = chat.status === "success" ? chat.data : null;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages?.length, contact.id]);

  const toggleHandler = async () => {
    const next: WhatsAppHandler = contact.handler === "ai" ? "staff" : "ai";
    if (!(await handler.run(contact.id, next))) {
      toast.show("Não foi possível mudar quem atende.", "error");
      return;
    }
    onChanged();
    toast.show(next === "staff" ? "Conversa com você. A IA não responde mais este cliente." : "Conversa devolvida para a IA.");
  };

  const changeKind = async (value: WhatsAppContactKind) => {
    if (!(await kind.run(contact.id, value))) toast.show("Não foi possível mudar o tipo do contato.", "error");
    else onChanged();
  };

  const refresh = () => {
    chat.reload();
    onChanged();
  };

  const title = contact.name ?? formatPhone(contact.phone);

  return (
    <section aria-label={`Conversa com ${title}`} className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-line px-3 py-3 sm:px-5">
        <button type="button" onClick={onBack} aria-label="Voltar para a lista" className={cn(compactButton.icon, "md:hidden")}>
          <ArrowLeft aria-hidden className="size-4" />
        </button>
        <ContactAvatar name={contact.name} phone={contact.phone} className="max-sm:hidden" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-white">{title}</h2>
          <div className="flex items-center gap-2 text-xs text-mist">
            <span className="shrink-0 tabular-nums">{formatPhone(contact.phone)}</span>
            <span aria-hidden>·</span>
            <label className="sr-only" htmlFor={`kind-${contact.id}`}>
              Tipo do contato
            </label>
            <select
              id={`kind-${contact.id}`}
              value={contact.kind}
              disabled={kind.pending}
              onChange={(event) => void changeKind(event.target.value as WhatsAppContactKind)}
              className="min-w-0 cursor-pointer rounded bg-transparent text-xs text-mist [color-scheme:dark] hover:text-fog focus-visible:outline-2 focus-visible:outline-electric"
            >
              {CONTACT_KINDS.map((value) => (
                <option key={value} value={value}>
                  {CONTACT_KIND_LABEL[value]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <a
          href={whatsappChatUrl(contact.phone)}
          target="_blank"
          rel="noreferrer"
          aria-label="Abrir no WhatsApp do celular"
          title="Abrir no WhatsApp do celular"
          className={compactButton.icon}
        >
          <ExternalLink aria-hidden className="size-4" />
        </a>
        <button
          type="button"
          disabled={handler.pending}
          onClick={() => void toggleHandler()}
          className={contact.handler === "ai" ? compactButton.primary : compactButton.secondary}
        >
          {contact.handler === "ai" ? "Assumir" : "Devolver para a IA"}
        </button>
      </header>

      {contact.handler === "staff" && contact.handoffSummary && (
        <div className="border-b border-line px-5 py-3">
          <p className="border-l-2 border-pink pl-3 text-sm leading-relaxed text-fog">
            <span className="mr-1.5 text-xs font-medium text-pink">A IA passou para você.</span>
            {contact.handoffSummary}
          </p>
        </div>
      )}
      {contact.optedOut && (
        <p className="border-b border-line px-5 py-3 text-xs text-mist">
          Este cliente pediu para parar as mensagens automáticas. A IA não responde; você ainda pode responder por aqui.
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto bg-night px-4 py-5 sm:px-6">
        {chat.status === "loading" && <LoadingBlock />}
        {chat.status === "error" && <ErrorState message={chat.error.message} onRetry={chat.reload} />}
        {messages && (
          <ol aria-live="polite" className="mx-auto max-w-3xl">
            {messages.map((message, index) => (
              <ChatBubble
                key={message.id}
                author={message.author}
                body={message.body}
                at={message.createdAt}
                showAuthor={index === 0 || messages[index - 1]!.author !== message.author}
                badge={<FailedBadge message={message} />}
                footer={
                  message.author === "staff" && (
                    <Link
                      to={teachLink(questionBefore(messages, index), message.body)}
                      aria-label="Ensinar essa resposta para a IA"
                      className="mt-1 inline-flex items-center gap-1 rounded px-1 text-[0.7rem] text-mist transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-electric"
                    >
                      <GraduationCap aria-hidden className="size-3.5" /> Ensinar à IA
                    </Link>
                  )
                }
              />
            ))}
            <li ref={endRef} aria-hidden />
          </ol>
        )}
      </div>

      <div className="border-t border-line p-3 sm:px-5">
        <Composer contact={contact} mode={mode} onSent={refresh} />
      </div>
    </section>
  );
}
