import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/ui/lib/cn";

export type Tone = "electric" | "pink" | "emerald" | "amber";

/** Cor do ícone e dos marcadores. O texto nunca usa a cor do tom: ela só identifica. */
export const TONE: Record<Tone, { icon: string; fill: string }> = {
  electric: { icon: "bg-electric/12 text-electric-soft ring-electric/25", fill: "#2799ff" },
  pink: { icon: "bg-pink/12 text-pink ring-pink/25", fill: "#ff66c4" },
  emerald: { icon: "bg-emerald-400/12 text-emerald-300 ring-emerald-400/25", fill: "#34d399" },
  amber: { icon: "bg-amber-400/12 text-amber-300 ring-amber-400/25", fill: "#fbbf24" },
};

export function ToneIcon({ icon: Icon, tone, className }: { icon: LucideIcon; tone: Tone; className?: string }) {
  return (
    <span aria-hidden className={cn("grid size-9 shrink-0 place-items-center rounded-xl ring-1 ring-inset", TONE[tone].icon, className)}>
      <Icon className="size-[1.05rem]" />
    </span>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: Tone;
  hint?: ReactNode;
  className?: string;
}

/** Número de destaque com ícone. Fica dentro de um `<dl>`. */
export function StatCard({ label, value, icon, tone, hint, className }: StatCardProps) {
  return (
    <div className={cn("rounded-2xl border border-line bg-surface/70 p-4 transition-colors hover:border-line-strong sm:p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <dt className="text-xs font-medium text-mist">{label}</dt>
        <ToneIcon icon={icon} tone={tone} className="size-8 rounded-lg" />
      </div>
      <dd className="mt-2 font-display text-[1.4rem] leading-tight font-semibold text-white tabular-nums sm:text-2xl">{value}</dd>
      {hint && <dd className="mt-1 text-xs text-mist">{hint}</dd>}
    </div>
  );
}

/** Cabeçalho de cada bloco do dashboard: rótulo curto e, se houver, o atalho para a tela completa. */
export function BlockHeading({ id, title, link }: { id: string; title: string; link?: { to: string; label: string } }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 id={id} className="text-[0.7rem] font-semibold tracking-[0.16em] text-mist uppercase">
        {title}
      </h2>
      {link && (
        <Link to={link.to} className="text-xs text-electric-soft underline-offset-4 hover:underline">
          {link.label}
        </Link>
      )}
    </div>
  );
}

export interface Segment {
  label: string;
  value: number;
  tone: Tone;
}

/** Barra de proporção: cada parte com 2px de folga da vizinha. Decorativa, os números aparecem ao lado. */
export function SegmentBar({ segments, className }: { segments: readonly Segment[]; className?: string }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  return (
    <div aria-hidden className={cn("flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-white/[0.05]", className)}>
      {total > 0 &&
        segments
          .filter((segment) => segment.value > 0)
          .map((segment) => (
            <span
              key={segment.label}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{ width: `${(segment.value / total) * 100}%`, background: TONE[segment.tone].fill }}
            />
          ))}
    </div>
  );
}
