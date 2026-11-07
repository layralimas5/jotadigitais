import { MessageCircle } from "lucide-react";
import { counterpartOf, hasUnseenFrom, type SupportRole, type SupportTicket } from "@/domain/support-ticket";
import { cn } from "@/ui/lib/cn";
import { formatRelative } from "../lib/dates";
import { authorNameOf } from "./SupportBadges";

/**
 * Última mensagem da conversa na ficha da lista: "Layra enviou uma mensagem · há 5 min".
 * Quando é do outro lado e quem está vendo ainda não abriu, fica em destaque.
 */
export function LastMessageNote({ ticket, role, className }: { ticket: SupportTicket; role: SupportRole; className?: string }) {
  const last = ticket.replies.at(-1);
  if (!last) return null;
  const unread = last.author?.role === counterpartOf(role) && hasUnseenFrom(ticket, role);
  return (
    <p
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
        unread ? "border-electric/50 bg-electric/10 font-semibold text-electric-soft" : "border-line text-fog",
        className,
      )}
    >
      <MessageCircle aria-hidden className="size-3.5 shrink-0" />
      <span className="truncate">
        {authorNameOf(last.author)} enviou uma mensagem · {formatRelative(last.createdAt)}
      </span>
      {unread && <span className="sr-only">(nova, ainda não aberta)</span>}
    </p>
  );
}
