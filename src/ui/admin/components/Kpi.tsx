import type { ReactNode } from "react";
import { cn } from "@/ui/lib/cn";

export type KpiTone = "positive" | "negative";

/** Número de destaque com rótulo. Fica dentro de um `<dl>`. */
export function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: ReactNode; tone?: KpiTone }) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        tone === "positive" && "border-emerald-400/30 bg-emerald-400/[0.06]",
        tone === "negative" && "border-alert/30 bg-alert/[0.06]",
        !tone && "border-line bg-surface/60",
      )}
    >
      <dt className="text-xs text-mist">{label}</dt>
      <dd className="mt-1 font-display text-xl font-semibold text-white tabular-nums sm:text-2xl">{value}</dd>
      {hint && <dd className="mt-0.5 text-xs text-mist">{hint}</dd>}
    </div>
  );
}
