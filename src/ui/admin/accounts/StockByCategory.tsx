import { TriangleAlert } from "lucide-react";
import { LOW_STOCK_THRESHOLD, STOCK_CATEGORY_LABEL, type StockCategory, type StockCount } from "@/domain/stock";
import { cn } from "@/ui/lib/cn";

interface StockByCategoryProps {
  counts: StockCount[];
  selected: StockCategory | null;
  onSelect: (category: StockCategory | null) => void;
}

const available = (count: number) => `${count} ${count === 1 ? "disponível" : "disponíveis"}`;

/** Quantas contas disponíveis de cada tipo; o tipo acabando fica em destaque. Tocar filtra a lista por ele. */
export function StockByCategory({ counts, selected, onSelect }: StockByCategoryProps) {
  if (counts.length === 0) return null;
  const low = counts.filter((count) => count.low);
  return (
    <section aria-labelledby="stock-by-category" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="stock-by-category" className="text-sm font-medium text-fog">Estoque por tipo</h2>
        <p className="text-xs text-mist">Toque em um tipo para ver só as contas dele.</p>
      </div>
      {low.length > 0 && (
        <p role="status" className="flex items-start gap-2 rounded-2xl border border-amber-300/30 bg-amber-300/[0.06] px-4 py-3 text-sm text-amber-100">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-200" />
          <span>
            Hora de repor: {low.map((count) => `${STOCK_CATEGORY_LABEL[count.category]} (${count.available})`).join(", ")}.{" "}
            <span className="text-amber-100/70">Aviso com {LOW_STOCK_THRESHOLD} disponíveis ou menos.</span>
          </span>
        </p>
      )}
      <ul className="flex flex-wrap gap-2">
        {counts.map((count) => {
          const active = selected === count.category;
          return (
            <li key={count.category}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(active ? null : count.category)}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-electric",
                  count.low ? "border-amber-300/40 bg-amber-300/[0.06] text-amber-100" : "border-line bg-surface/60 text-fog hover:border-line-strong hover:text-white",
                  active && "border-electric bg-electric/[0.12] text-white",
                )}
              >
                {count.low && <TriangleAlert aria-hidden className="size-3.5 text-amber-200" />}
                <span>{STOCK_CATEGORY_LABEL[count.category]}</span>
                <strong aria-hidden className="font-display font-semibold text-white tabular-nums">{count.available}</strong>
                <span className="sr-only">{available(count.available)}{count.low ? ", acabando" : ""}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
