import type { ReactNode } from "react";
import { CHAT_AUTHOR_LABEL, type ChatAuthor } from "@/domain/whatsapp";
import { cn } from "@/ui/lib/cn";
import { WhatsAppText } from "../delivery/WhatsAppBubble";

const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

const BUBBLE_TONE: Record<ChatAuthor, string> = {
  customer: "bg-surface-2 text-fog",
  ai: "bg-[#0f2236] text-[#e6f1fb]",
  staff: "bg-[#13283f] text-white ring-1 ring-inset ring-electric/25",
  system: "bg-transparent text-mist ring-1 ring-inset ring-line-strong",
};

interface ChatBubbleProps {
  author: ChatAuthor;
  body: string;
  /** ISO. Sem data (simulador), não mostra a hora. */
  at?: string;
  /** Mostra quem escreveu acima do balão: só quando o autor muda. */
  showAuthor?: boolean;
  /** Aviso discreto ao lado da hora ("Não enviada"). */
  badge?: ReactNode;
  footer?: ReactNode;
}

/** Cliente à esquerda, loja (IA, Jota, automático) à direita. */
export function ChatBubble({ author, body, at, showAuthor = true, badge, footer }: ChatBubbleProps) {
  const fromStore = author !== "customer";
  return (
    <li className={cn("flex flex-col", fromStore ? "items-end" : "items-start", showAuthor ? "mt-4 first:mt-0" : "mt-1")}>
      {showAuthor && <p className="mb-1 px-1 text-[0.7rem] font-medium text-mist">{CHAT_AUTHOR_LABEL[author]}</p>}
      <div
        className={cn(
          "max-w-[min(85%,32rem)] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-line [overflow-wrap:anywhere]",
          fromStore ? "rounded-br-md" : "rounded-bl-md",
          BUBBLE_TONE[author],
        )}
      >
        <WhatsAppText text={body} />
        {(at || badge) && (
          <span className="float-right mt-1.5 ml-3 inline-flex translate-y-0.5 items-center gap-1.5 text-[0.65rem] text-mist tabular-nums">
            {badge}
            {at && <time dateTime={at}>{time.format(new Date(at))}</time>}
          </span>
        )}
      </div>
      {footer}
    </li>
  );
}
