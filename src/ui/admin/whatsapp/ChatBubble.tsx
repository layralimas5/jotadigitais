import type { ReactNode } from "react";
import { CHAT_AUTHOR_LABEL, type ChatAuthor } from "@/domain/whatsapp";
import { cn } from "@/ui/lib/cn";
import { WhatsAppText } from "../delivery/WhatsAppBubble";

const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

const AUTHOR_TONE: Record<ChatAuthor, string> = {
  customer: "text-mist",
  ai: "text-electric-soft",
  staff: "text-emerald-300",
  system: "text-mist",
};

interface ChatBubbleProps {
  author: ChatAuthor;
  body: string;
  /** ISO. Sem data (simulador), não mostra a hora. */
  at?: string;
  /** Selo ao lado da hora: "Teste", "Falhou". */
  badge?: ReactNode;
  footer?: ReactNode;
}

/** Balão no estilo do WhatsApp Web: cliente à esquerda, loja (IA, Jota, automático) à direita. */
export function ChatBubble({ author, body, at, badge, footer }: ChatBubbleProps) {
  const fromStore = author !== "customer";
  return (
    <li className={cn("flex flex-col gap-1", fromStore ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[min(85%,30rem)] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-line text-[#e9edef] [overflow-wrap:anywhere]",
          fromStore ? "rounded-tr-sm bg-[#005c4b]" : "rounded-tl-sm bg-[#202c33]",
          author === "system" && "bg-[#1f3b36]",
        )}
      >
        <WhatsAppText text={body} />
      </div>
      <p className="flex flex-wrap items-center gap-1.5 px-1 text-[0.7rem]">
        <span className={cn("font-semibold", AUTHOR_TONE[author])}>{CHAT_AUTHOR_LABEL[author]}</span>
        {at && (
          <time dateTime={at} className="text-mist">
            {time.format(new Date(at))}
          </time>
        )}
        {badge}
      </p>
      {footer}
    </li>
  );
}
