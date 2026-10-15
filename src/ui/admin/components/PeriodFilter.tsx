import { PERIOD_LABEL, PERIOD_PRESETS, type PeriodPreset } from "@/domain/finance";
import { cn } from "@/ui/lib/cn";

export function PeriodFilter({ value, onChange }: { value: PeriodPreset; onChange: (preset: PeriodPreset) => void }) {
  return (
    <div role="group" aria-label="Período" className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
      {PERIOD_PRESETS.map((preset) => (
        <button
          key={preset}
          type="button"
          aria-pressed={value === preset}
          onClick={() => onChange(preset)}
          className={cn(
            "shrink-0 rounded-full border px-4 py-2 text-sm transition-colors",
            value === preset ? "border-electric bg-electric/15 text-white" : "border-line-strong text-mist hover:text-white",
          )}
        >
          {PERIOD_LABEL[preset]}
        </button>
      ))}
    </div>
  );
}
