import { CheckCircle2, Clock } from "lucide-react";
import { formatQueueTime, queueAgeTone, queueTimeMs, type QueueAgeTone, type SupportTicket } from "@/domain/support-ticket";
import { cn } from "@/ui/lib/cn";
import { formatDate } from "../lib/dates";

const TONE: Record<QueueAgeTone, string> = {
  fresh: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  aging: "border-amber-400/35 bg-amber-400/10 text-amber-200",
  late: "border-red-400/40 bg-red-500/10 text-[#ff9a9a]",
};

/** Há quanto tempo o chamado está aberto (verde, amarelo, vermelho); finalizado mostra quanto levou. */
export function QueueAgeBadge({ ticket, now }: { ticket: Pick<SupportTicket, "createdAt" | "resolvedAt" | "status">; now?: Date }) {
  const ms = queueTimeMs(ticket, now);
  const done = ticket.status === "done";
  const text = done ? `Resolvido em ${formatQueueTime(ms)}` : `Aberto há ${formatQueueTime(ms)}`;
  return (
    <span
      title={`Aberto em ${formatDate(ticket.createdAt)}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.68rem] font-semibold tabular-nums",
        done ? "border-white/15 bg-white/[0.05] text-mist" : TONE[queueAgeTone(ms)],
      )}
    >
      {done ? <CheckCircle2 aria-hidden className="size-3" /> : <Clock aria-hidden className="size-3" />}
      {text}
    </span>
  );
}
