import { useEffect, useRef, useState } from "react";
import type { SeriesPoint } from "@/domain/finance";
import { formatBRL } from "@/domain/money";
import { cn } from "@/ui/lib/cn";

/** Cores validadas (dataviz) contra o fundo escuro do painel: separáveis também para daltônicos. */
export const SERIES_COLOR = { revenue: "#228ef0", expenses: "#d34d9c" } as const;

const HEIGHT = 240;
const MARGIN = { top: 12, right: 8, bottom: 26, left: 64 };
const BAR_GAP = 2;
const MAX_BAR = 26;
/** Espaço mínimo por rótulo do eixo X, para as datas não encostarem umas nas outras. */
const MIN_LABEL_SPACE = 64;

export const compactBRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });

export function niceCeil(value: number): number {
  if (value <= 0) return 10_000; // R$ 100,00: eixo com escala mesmo sem movimento
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude >= value) ?? 10;
  return step * magnitude;
}

/** Barra presa na linha de base, com só o topo arredondado (4px). */
function barPath(x: number, y: number, width: number, height: number): string {
  if (height <= 0) return "";
  const radius = Math.min(4, width / 2, height);
  return [
    `M${x},${y + height}`,
    `V${y + radius}`,
    `Q${x},${y} ${x + radius},${y}`,
    `H${x + width - radius}`,
    `Q${x + width},${y} ${x + width},${y + radius}`,
    `V${y + height}`,
    "Z",
  ].join(" ");
}

export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

export function Legend() {
  return (
    <ul className="flex flex-wrap gap-4 text-xs text-fog">
      <li className="flex items-center gap-2">
        <span aria-hidden className="size-2.5 rounded-sm" style={{ background: SERIES_COLOR.revenue }} /> Faturamento
      </li>
      <li className="flex items-center gap-2">
        <span aria-hidden className="size-2.5 rounded-sm" style={{ background: SERIES_COLOR.expenses }} /> Despesas
      </li>
    </ul>
  );
}

export function ChartTable({ series }: { series: SeriesPoint[] }) {
  const rows = series.filter((point) => point.revenue > 0 || point.expenses > 0);
  if (rows.length === 0) return <p className="py-10 text-center text-sm text-mist">Nenhum movimento no período.</p>;
  return (
    <div className="max-h-72 overflow-y-auto rounded-2xl border border-line">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-surface text-xs text-mist">
          <tr>
            <th scope="col" className="px-4 py-2 font-medium">Período</th>
            <th scope="col" className="px-4 py-2 text-right font-medium">Faturamento</th>
            <th scope="col" className="px-4 py-2 text-right font-medium">Despesas</th>
            <th scope="col" className="px-4 py-2 text-right font-medium">Resultado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((point) => (
            <tr key={point.key}>
              <th scope="row" className="px-4 py-2 font-normal text-fog">{point.label}</th>
              <td className="px-4 py-2 text-right text-white tabular-nums">{formatBRL(point.revenue)}</td>
              <td className="px-4 py-2 text-right text-white tabular-nums">{formatBRL(point.expenses)}</td>
              <td className="px-4 py-2 text-right text-fog tabular-nums">{formatBRL(point.revenue - point.expenses)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BarsPlot({ series }: { series: SeriesPoint[] }) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const max = niceCeil(Math.max(...series.map((point) => Math.max(point.revenue, point.expenses)), 0));
  const band = series.length ? innerWidth / series.length : 0;
  const barWidth = Math.max(1, Math.min(MAX_BAR, (band * 0.72 - BAR_GAP) / 2));
  const scaleY = (value: number) => innerHeight - (value / max) * innerHeight;
  const maxLabels = Math.max(2, Math.floor(innerWidth / MIN_LABEL_SPACE));
  const labelEvery = Math.max(1, Math.ceil(series.length / maxLabels));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ratio * max);
  const activePoint = active === null ? null : series[active];

  return (
    <div ref={ref} className="relative" onMouseLeave={() => setActive(null)}>
      {width > 0 && (
        <svg width={width} height={HEIGHT} role="img" aria-label="Faturamento e despesas por período">
          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            {ticks.map((tick) => (
              <g key={tick} transform={`translate(0,${scaleY(tick)})`}>
                <line x2={innerWidth} stroke="currentColor" className={tick === 0 ? "text-line-strong" : "text-line"} />
                <text x={-10} dy="0.32em" textAnchor="end" className="fill-mist text-[11px] tabular-nums">
                  {compactBRL.format(tick / 100)}
                </text>
              </g>
            ))}
            {series.map((point, index) => {
              const x = index * band + (band - (barWidth * 2 + BAR_GAP)) / 2;
              const revenueY = scaleY(point.revenue);
              const expensesY = scaleY(point.expenses);
              return (
                <g key={point.key}>
                  {active === index && <rect x={index * band} width={band} height={innerHeight} className="fill-white/[0.04]" />}
                  <path d={barPath(x, revenueY, barWidth, innerHeight - revenueY)} fill={SERIES_COLOR.revenue} />
                  <path d={barPath(x + barWidth + BAR_GAP, expensesY, barWidth, innerHeight - expensesY)} fill={SERIES_COLOR.expenses} />
                  {index % labelEvery === 0 && (
                    <text x={index * band + band / 2} y={innerHeight + 18} textAnchor="middle" className="fill-mist text-[11px]">
                      {point.label}
                    </text>
                  )}
                  <rect
                    x={index * band}
                    width={band}
                    height={innerHeight}
                    fill="transparent"
                    tabIndex={0}
                    role="img"
                    aria-label={`${point.label}: faturamento ${formatBRL(point.revenue)}, despesas ${formatBRL(point.expenses)}`}
                    onMouseEnter={() => setActive(index)}
                    onFocus={() => setActive(index)}
                    onBlur={() => setActive(null)}
                    className="cursor-default outline-none focus-visible:stroke-electric focus-visible:stroke-2"
                  />
                </g>
              );
            })}
          </g>
        </svg>
      )}
      {activePoint && active !== null && (
        <div
          role="presentation"
          className="pointer-events-none absolute top-2 z-10 min-w-44 rounded-xl border border-line-strong bg-surface-2 px-3 py-2 text-xs shadow-2xl shadow-black/60"
          style={{
            left: Math.min(Math.max(MARGIN.left + active * band + band / 2 - 88, 0), Math.max(0, width - 176)),
          }}
        >
          <p className="font-semibold text-white">{activePoint.label}</p>
          <p className="mt-1 flex items-center justify-between gap-3 text-fog">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-sm" style={{ background: SERIES_COLOR.revenue }} /> Faturamento
            </span>
            <span className="text-white tabular-nums">{formatBRL(activePoint.revenue)}</span>
          </p>
          <p className="mt-0.5 flex items-center justify-between gap-3 text-fog">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-sm" style={{ background: SERIES_COLOR.expenses }} /> Despesas
            </span>
            <span className="text-white tabular-nums">{formatBRL(activePoint.expenses)}</span>
          </p>
        </div>
      )}
    </div>
  );
}

export function RevenueChart({ series }: { series: SeriesPoint[] }) {
  const [asTable, setAsTable] = useState(false);
  const empty = series.every((point) => point.revenue === 0 && point.expenses === 0);
  return (
    <section aria-labelledby="chart-title" className="rounded-3xl border border-line bg-surface/60 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="chart-title" className="font-display text-base font-semibold text-white">
            Faturamento e despesas
          </h2>
          <div className="mt-2">
            <Legend />
          </div>
        </div>
        <button
          type="button"
          aria-pressed={asTable}
          onClick={() => setAsTable((value) => !value)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            asTable ? "border-electric bg-electric/15 text-white" : "border-line-strong text-mist hover:text-white",
          )}
        >
          Ver como tabela
        </button>
      </div>
      <div className="mt-5">
        {asTable ? (
          <ChartTable series={series} />
        ) : empty ? (
          <p className="grid h-[240px] place-items-center rounded-2xl border border-dashed border-line-strong text-sm text-mist">
            Nenhum movimento no período.
          </p>
        ) : (
          <BarsPlot series={series} />
        )}
      </div>
    </section>
  );
}
