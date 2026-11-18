import { Check, Copy } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/ui/lib/cn";

export function StatTile({ label, value, hint, highlight = false }: { label: string; value: string; hint?: ReactNode; highlight?: boolean }) {
  return (
    <div className={cn("min-w-0 rounded-2xl border p-4 sm:p-5", highlight ? "border-electric/40 bg-electric/[0.07]" : "border-line bg-surface/70")}>
      <dt className="text-xs text-mist sm:text-sm">{label}</dt>
      <dd className="mt-1 truncate font-display text-xl font-bold text-white tabular-nums sm:text-2xl">{value}</dd>
      {hint && <dd className="mt-1 text-xs text-mist">{hint}</dd>}
    </div>
  );
}

export function PanelSection({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-surface/50 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-base font-semibold text-white sm:text-lg">{title}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Copia o texto e confirma por 2 s. Se o navegador não deixar copiar, avisa em vez de falhar calado. */
export function CopyButton({ text, label, className }: { text: string; label: string; className?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timer = window.setTimeout(() => setState("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [state]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch (error) {
      console.warn("Não deu para copiar", error);
      setState("failed");
    }
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className={cn(
        "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric",
        state === "copied" ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-200" : "border-line-strong bg-white/[0.03] text-white hover:bg-white/[0.07]",
        className,
      )}
    >
      {state === "copied" ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
      <span aria-live="polite">{state === "copied" ? "Copiado" : state === "failed" ? "Copie à mão" : label}</span>
    </button>
  );
}

/** Link em destaque com o botão de copiar ao lado. */
export function LinkBox({ link, label = "Copiar link" }: { link: string; label?: string }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        readOnly
        value={link}
        aria-label="Seu link"
        onFocus={(event) => event.currentTarget.select()}
        className="h-10 min-w-0 flex-1 rounded-full border border-line bg-ink/70 px-4 font-mono text-xs text-fog focus:border-electric focus:outline-none"
      />
      <CopyButton text={link} label={label} />
    </div>
  );
}
