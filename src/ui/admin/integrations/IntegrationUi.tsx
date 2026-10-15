import { CheckCircle2, ChevronDown, Circle, Clock, Wrench, Zap, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/ui/lib/cn";

export type ConnectionTone = "connected" | "working" | "action" | "setup" | "soon";

const TONE: Record<ConnectionTone, { icon: LucideIcon; className: string }> = {
  connected: { icon: CheckCircle2, className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" },
  working: { icon: Zap, className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" },
  action: { icon: Circle, className: "border-electric/40 bg-electric/10 text-electric-soft" },
  setup: { icon: Wrench, className: "border-amber-400/30 bg-amber-400/10 text-amber-300" },
  soon: { icon: Clock, className: "border-white/15 bg-white/[0.05] text-mist" },
};

/** Situação da conexão com ícone e texto: a cor nunca é a única pista. */
export function StatusChip({ tone, children }: { tone: ConnectionTone; children: ReactNode }) {
  const { icon: Icon, className } = TONE[tone];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", className)}>
      <Icon aria-hidden className="size-3.5" /> {children}
    </span>
  );
}

interface IntegrationShellProps {
  icon: ReactNode;
  title: string;
  description: string;
  status: ReactNode;
  /** O card em destaque ocupa a largura toda e ganha a borda colorida. */
  featured?: boolean;
  children?: ReactNode;
}

export function IntegrationShell({ icon, title, description, status, featured = false, children }: IntegrationShellProps) {
  const card = (
    <section
      aria-label={title}
      className={cn("flex h-full flex-col rounded-3xl bg-surface p-5 sm:p-6", featured ? "rounded-[calc(1.5rem-1px)]" : "border border-line bg-surface/60")}
    >
      <div className="flex flex-wrap items-start gap-4">
        <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-2xl border border-line-strong bg-ink">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h3 className="font-display text-base font-semibold text-white">{title}</h3>
            {status}
          </div>
          <p className="mt-1 text-sm leading-relaxed text-mist">{description}</p>
        </div>
      </div>
      {children && <div className="mt-5 flex-1">{children}</div>}
    </section>
  );
  return featured ? <div className="rounded-3xl bg-gradient-to-br from-electric/50 via-violet/40 to-pink/40 p-px">{card}</div> : card;
}

/** Passo a passo numerado, em frases curtas, para quem nunca conectou nada. */
export function Steps({ title, steps }: { title: string; steps: readonly ReactNode[] }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.14em] text-mist uppercase">{title}</p>
      <ol className="mt-3 space-y-2.5">
        {steps.map((step, index) => (
          <li key={index} className="flex gap-3 text-sm leading-relaxed text-fog">
            <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full bg-electric/15 font-display text-xs font-semibold text-electric-soft">
              {index + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Passos técnicos ficam fechados: o Jota não precisa ver, quem instala abre. */
export function TechnicalSetup({ steps }: { steps: readonly ReactNode[] }) {
  return (
    <details className="group rounded-2xl border border-line bg-ink/40">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-fog hover:text-white focus-visible:outline-2 focus-visible:outline-electric [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <Wrench aria-hidden className="size-4 text-amber-300" /> Passo a passo técnico (para quem instala o sistema)
        </span>
        <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      <div className="border-t border-line px-4 py-4">
        <Steps title="Uma vez só, uns 10 minutos" steps={steps} />
      </div>
    </details>
  );
}
