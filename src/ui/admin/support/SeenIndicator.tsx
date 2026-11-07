import { Eye, EyeOff } from "lucide-react";
import type { AdminRole } from "@/domain/admin-user";
import { counterpartOf, lastMessageAtFrom, seenAtBy, SUPPORT_ROLE_NAME, wasSeenBy, type SupportTicket } from "@/domain/support-ticket";
import { cn } from "@/ui/lib/cn";
import { formatDate, formatRelative } from "../lib/dates";

interface SeenMarkProps {
  seen: boolean;
  /** Quem viu (ou não): "Jota" ou "Layra". */
  by: string;
  seenAt: string | null;
  className?: string;
}

/** Olhinho de visto: aberto e azul quando a outra pessoa já viu, riscado quando ainda não. */
export function SeenMark({ seen, by, seenAt, className }: SeenMarkProps) {
  const Icon = seen ? Eye : EyeOff;
  const text = seen ? `${by} viu` : `${by} ainda não viu`;
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-xs", seen ? "text-electric-soft" : "text-mist", className)}
      title={seen && seenAt ? `${by} viu em ${formatDate(seenAt)}` : undefined}
    >
      <Icon aria-hidden className="size-3.5" />
      {text}
      {seen && seenAt && <span className="opacity-80">· {formatRelative(seenAt)}</span>}
    </span>
  );
}

/** Na ficha da lista: a última mensagem de quem está vendo já foi vista pelo outro lado? */
export function TicketSeenMark({ ticket, role, className }: { ticket: SupportTicket; role: AdminRole; className?: string }) {
  const mine = lastMessageAtFrom(ticket, role);
  if (!mine || ticket.internal) return null;
  const other = counterpartOf(role);
  return <SeenMark seen={wasSeenBy(ticket, other, mine)} by={SUPPORT_ROLE_NAME[other]} seenAt={seenAtBy(ticket, other)} className={className} />;
}
