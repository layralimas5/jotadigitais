import { Hourglass } from "lucide-react";
import { lastActivityAt, STALE_LATE_DAYS, staleDaysOf, type SupportTicket } from "@/domain/support-ticket";
import { cn } from "@/ui/lib/cn";
import { formatDate } from "../lib/dates";

/** "Parado há 4 dias": sem resposta nem troca de situação. Âmbar a partir de 3 dias, vermelho a partir de 7. */
export function StaleBadge({ ticket, now }: { ticket: Pick<SupportTicket, "createdAt" | "replies" | "events" | "status">; now?: Date }) {
  const days = staleDaysOf(ticket, now);
  if (days === null) return null;
  const late = days >= STALE_LATE_DAYS;
  return (
    <span
      title={`Sem resposta nem troca de situação desde ${formatDate(lastActivityAt(ticket))}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.68rem] font-semibold tabular-nums",
        late ? "border-red-400/40 bg-red-500/10 text-[#ff9a9a]" : "border-amber-400/35 bg-amber-400/10 text-amber-200",
      )}
    >
      <Hourglass aria-hidden className="size-3" />
      Parado há {days} dias
    </span>
  );
}
