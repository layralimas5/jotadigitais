import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CalendarDays, Check, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  DASHBOARD_PRESETS,
  DASHBOARD_PRESET_LABEL,
  dashboardRangeOf,
  periodLabelOf,
  type DashboardPeriod,
} from "@/domain/dashboard-period";
import { toLocalIsoDate } from "@/domain/finance";
import { cn } from "@/ui/lib/cn";
import { useCloseOnOutsideClick } from "../lib/use-close-on-outside";

interface DashboardPeriodPickerProps {
  value: DashboardPeriod;
  onChange: (period: DashboardPeriod) => void;
}

const fieldClass =
  "h-10 w-full min-w-0 rounded-xl border border-line-strong bg-ink px-3 text-sm text-white [color-scheme:dark] focus:border-electric focus:outline-none";

function MonthField({ value, onChange }: DashboardPeriodPickerProps) {
  const id = useId();
  const today = toLocalIsoDate(new Date());
  return (
    <div>
      <label htmlFor={id} className="text-xs font-medium text-mist">
        Mês específico
      </label>
      <input
        id={id}
        type="month"
        max={today.slice(0, 7)}
        value={value.kind === "month" ? value.month : ""}
        onChange={(event) => event.target.value && onChange({ kind: "month", month: event.target.value })}
        className={cn(fieldClass, "mt-1.5")}
      />
    </div>
  );
}

function CustomRangeForm({ value, onChange }: DashboardPeriodPickerProps) {
  const fromId = useId();
  const toId = useId();
  const today = toLocalIsoDate(new Date());
  const current = dashboardRangeOf(value);
  const [from, setFrom] = useState(current.from ?? today);
  const [to, setTo] = useState(current.to);
  const valid = Boolean(from && to && from <= to);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (valid) onChange({ kind: "custom", from, to });
  };

  return (
    <form onSubmit={onSubmit} noValidate>
      <p className="text-xs font-medium text-mist">Intervalo de dias</p>
      <div className="mt-1.5 grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={fromId} className="sr-only">
            De
          </label>
          <input id={fromId} type="date" max={to || today} value={from} onChange={(event) => setFrom(event.target.value)} className={fieldClass} />
        </div>
        <div>
          <label htmlFor={toId} className="sr-only">
            Até
          </label>
          <input id={toId} type="date" min={from} max={today} value={to} onChange={(event) => setTo(event.target.value)} className={fieldClass} />
        </div>
      </div>
      {!valid && <p className="mt-1.5 text-xs text-alert">A data inicial precisa vir antes da final.</p>}
      <button
        type="submit"
        disabled={!valid}
        className="mt-2.5 h-10 w-full rounded-xl bg-electric text-sm font-semibold text-ink transition-colors hover:bg-[#4aaaff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric disabled:opacity-40"
      >
        Aplicar intervalo
      </button>
    </form>
  );
}

interface PeriodPickerOptions {
  /** Lado em que o painel abre a partir do botão, no computador. */
  align?: "start" | "end";
  /** Lido pelo leitor de tela antes do período escolhido. */
  label?: string;
}

const PANEL_ALIGN = {
  start: "sm:origin-top-left",
  end: "sm:right-0 sm:left-auto sm:origin-top-right",
} as const;

export function DashboardPeriodPicker({
  value,
  onChange,
  align = "end",
  label = "Período do dashboard",
}: DashboardPeriodPickerProps & PeriodPickerOptions) {
  const reduceMotion = useReducedMotion();
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  useCloseOnOutsideClick(open, close, rootRef);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const choose = (period: DashboardPeriod) => {
    onChange(period);
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div ref={rootRef} className="relative self-start sm:self-auto">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface px-3.5 py-1.5 text-xs text-fog transition-colors hover:border-white/25 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric"
      >
        <CalendarDays aria-hidden className="size-3.5 text-electric-soft" />
        <span className="sr-only">{label}:</span>
        {periodLabelOf(value)}
        <ChevronDown aria-hidden className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={panelId}
            role="dialog"
            aria-label="Escolher período"
            initial={reduceMotion ? false : { opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "absolute top-full left-0 z-30 mt-2 w-[min(18.5rem,calc(100vw-2rem))] origin-top-left rounded-2xl border border-line-strong bg-surface-2 p-3 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.8)]", PANEL_ALIGN[align])}
          >
            <ul role="list" className="grid grid-cols-2 gap-1">
              {DASHBOARD_PRESETS.map((preset) => {
                const active = value.kind === "preset" && value.preset === preset;
                return (
                  <li key={preset}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => choose({ kind: "preset", preset })}
                      className={cn(
                        "flex w-full items-center justify-between gap-1 rounded-lg px-2.5 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-electric",
                        active ? "bg-electric/15 text-white" : "text-fog hover:bg-white/[0.05] hover:text-white",
                      )}
                    >
                      {DASHBOARD_PRESET_LABEL[preset]}
                      {active && <Check aria-hidden className="size-3.5 shrink-0 text-electric" />}
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 space-y-3 border-t border-line pt-3">
              <MonthField value={value} onChange={onChange} />
              <CustomRangeForm value={value} onChange={choose} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
