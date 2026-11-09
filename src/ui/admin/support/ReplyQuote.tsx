import { CornerUpLeft, X } from "lucide-react";
import type { SupportQuote } from "@/domain/support-ticket";
import { cn } from "@/ui/lib/cn";
import { authorNameOf } from "./SupportBadges";

export const messageAnchorOf = (id: string) => `mensagem-${id}`;

/** Leva até a mensagem citada e pisca nela, para achar o assunto no meio da conversa. */
export function scrollToMessage(id: string, onHighlight: (id: string) => void) {
  const target = document.getElementById(messageAnchorOf(id));
  if (!target) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  target.focus({ preventScroll: true });
  onHighlight(id);
}

/** Trecho da mensagem respondida, dentro do balão da resposta. Clicar leva até a original. */
export function QuoteInMessage({ quote, onOpen }: { quote: SupportQuote | null; onOpen: (id: string) => void }) {
  if (!quote) {
    return <p className="mt-2 rounded-xl border-l-2 border-line-strong bg-ink/40 px-3 py-2 text-xs text-mist italic">Mensagem respondida não está mais disponível.</p>;
  }
  return (
    <button
      type="button"
      onClick={() => onOpen(quote.id)}
      aria-label={`Ver a mensagem respondida, de ${authorNameOf(quote.author)}`}
      className="mt-2 block w-full rounded-xl border-l-2 border-electric bg-ink/50 px-3 py-2 text-left transition-colors hover:bg-ink/80 focus-visible:outline-2 focus-visible:outline-electric"
    >
      <span className="block text-xs font-semibold text-electric-soft">{authorNameOf(quote.author)}</span>
      <span className="mt-0.5 line-clamp-2 text-xs break-words whitespace-pre-wrap text-mist">{quote.body}</span>
    </button>
  );
}

/** Acima do campo de resposta: qual mensagem está sendo respondida, com o X para desistir. */
export function ReplyingTo({ quote, onCancel, className }: { quote: SupportQuote; onCancel: () => void; className?: string }) {
  return (
    <div role="status" className={cn("flex items-start gap-3 rounded-xl border-l-2 border-electric bg-electric/[0.07] px-3 py-2", className)}>
      <CornerUpLeft aria-hidden className="mt-0.5 size-4 shrink-0 text-electric-soft" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-electric-soft">Respondendo a {authorNameOf(quote.author)}</p>
        <p className="mt-0.5 line-clamp-2 text-xs break-words whitespace-pre-wrap text-mist">{quote.body}</p>
      </div>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancelar a resposta a esta mensagem"
        title="Cancelar (Esc)"
        className="grid size-7 shrink-0 place-items-center rounded-full text-mist hover:bg-white/[0.06] hover:text-white focus-visible:outline-2 focus-visible:outline-electric"
      >
        <X aria-hidden className="size-4" />
      </button>
    </div>
  );
}
