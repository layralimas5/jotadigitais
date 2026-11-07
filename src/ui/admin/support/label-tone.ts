import type { SupportLabelColor } from "@/domain/support-ticket";

/** Cor de cada etiqueta: bolinha (listas e seletor) e etiqueta (cartões e chamado). */
export const LABEL_TONE: Record<SupportLabelColor, { dot: string; badge: string }> = {
  electric: { dot: "bg-electric", badge: "border-electric/40 bg-electric/10 text-electric-soft" },
  emerald: { dot: "bg-emerald-400", badge: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" },
  amber: { dot: "bg-amber-300", badge: "border-amber-300/40 bg-amber-300/10 text-amber-200" },
  pink: { dot: "bg-pink", badge: "border-pink/40 bg-pink/10 text-pink" },
  violet: { dot: "bg-violet-400", badge: "border-violet-400/40 bg-violet-400/10 text-violet-200" },
  red: { dot: "bg-alert", badge: "border-alert/40 bg-alert/10 text-[#ff8a8a]" },
  gray: { dot: "bg-white/50", badge: "border-white/20 bg-white/[0.06] text-fog" },
};
