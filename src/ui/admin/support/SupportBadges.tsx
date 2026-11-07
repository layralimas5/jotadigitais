import {
  SUPPORT_AREA_LABEL,
  SUPPORT_PRIORITY_LABEL,
  SUPPORT_STATUS_LABEL,
  type SupportArea,
  type SupportAuthor,
  type SupportPriority,
  type SupportStatus,
} from "@/domain/support-ticket";
import { cn } from "@/ui/lib/cn";

const pill = "inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold";

const STATUS_TONE: Record<SupportStatus, string> = {
  open: "border-pink/30 bg-pink/10 text-pink",
  in_progress: "border-electric/40 bg-electric/10 text-electric-soft",
  done: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
};

const PRIORITY_TONE: Record<SupportPriority, string> = {
  low: "border-white/15 bg-white/[0.04] text-mist",
  normal: "border-white/15 bg-white/[0.06] text-fog",
  urgent: "border-alert/40 bg-alert/10 text-[#ff8a8a]",
};

export function SupportStatusBadge({ status }: { status: SupportStatus }) {
  return <span className={cn(pill, STATUS_TONE[status])}>{SUPPORT_STATUS_LABEL[status]}</span>;
}

export function SupportPriorityBadge({ priority }: { priority: SupportPriority }) {
  return <span className={cn(pill, PRIORITY_TONE[priority])}>{SUPPORT_PRIORITY_LABEL[priority]}</span>;
}

export function SupportAreaBadge({ area }: { area: SupportArea }) {
  return <span className={cn(pill, "border-line-strong text-fog")}>{SUPPORT_AREA_LABEL[area]}</span>;
}

/** "Jota" ou "Layra"; quem foi removido do sistema vira "Usuário removido". */
export const authorNameOf = (author: SupportAuthor | null): string => author?.name ?? (author ? "Sem nome" : "Usuário removido");
