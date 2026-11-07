import type { SupportPriority } from "@/domain/support-ticket";

/** Cor de cada prioridade, igual na ficha e nas etiquetas: baixa amarela, normal verde, urgente vermelha. */
export const PRIORITY_TONE: Record<SupportPriority, { dot: string; badge: string; selected: string }> = {
  low: {
    dot: "bg-amber-300",
    badge: "border-amber-300/40 bg-amber-300/10 text-amber-200",
    selected: "border-amber-300 bg-amber-300/15 text-amber-100",
  },
  normal: {
    dot: "bg-emerald-400",
    badge: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    selected: "border-emerald-400 bg-emerald-400/15 text-emerald-100",
  },
  urgent: {
    dot: "bg-alert",
    badge: "border-alert/40 bg-alert/10 text-[#ff8a8a]",
    selected: "border-alert bg-alert/15 text-[#ffd0d0]",
  },
};
