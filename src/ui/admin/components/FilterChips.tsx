import { cn } from "@/ui/lib/cn";

export interface FilterChipOption<T extends string> {
  value: T;
  label: string;
  /** Quantidade ao lado do rótulo, ex.: "Do site 12". */
  count?: number;
}

interface FilterChipsProps<T extends string> {
  label: string;
  value: T;
  options: readonly FilterChipOption<T>[];
  onChange: (value: T) => void;
}

/** Botões em pílula para alternar um recorte da lista. Rola de lado no celular. */
export function FilterChips<T extends string>({ label, value, options, onChange }: FilterChipsProps<T>) {
  return (
    <div role="group" aria-label={label} className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors",
              active ? "border-electric bg-electric/15 text-white" : "border-line-strong text-mist hover:text-white",
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span className={cn("rounded-full px-1.5 text-xs tabular-nums", active ? "bg-electric/25 text-white" : "bg-white/[0.06]")}>
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
