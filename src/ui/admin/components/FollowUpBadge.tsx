import { CalendarClock } from "lucide-react";
import { followUpStatusOf, type Lead } from "@/domain/lead";
import { cn } from "@/ui/lib/cn";
import { formatIsoDate } from "../lib/dates";

const TONE = {
  overdue: "border-alert/40 bg-alert/10 text-[#ff9a9a]",
  today: "border-pink/40 bg-pink/10 text-pink",
  upcoming: "border-line-strong bg-white/[0.03] text-fog",
} as const;

/** Quando chamar o lead de novo. Some quando ele já fechou ou desistiu. */
export function FollowUpBadge({ lead, today }: { lead: Pick<Lead, "stage" | "nextFollowUp">; today: string }) {
  const status = followUpStatusOf(lead, today);
  if (!status || !lead.nextFollowUp) return null;
  const label =
    status === "overdue" ? `Atrasado, ${formatIsoDate(lead.nextFollowUp)}` : status === "today" ? "Retornar hoje" : `Retornar ${formatIsoDate(lead.nextFollowUp)}`;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold", TONE[status])}>
      <CalendarClock aria-hidden className="size-3" /> {label}
    </span>
  );
}
