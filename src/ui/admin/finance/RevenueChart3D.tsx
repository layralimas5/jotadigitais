import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import type { SeriesPoint } from "@/domain/finance";
import { formatBRL } from "@/domain/money";
import { cn } from "@/ui/lib/cn";
import { EASE_OUT_EXPO } from "@/ui/lib/motion";
import { ChartTable, Legend, SERIES_COLOR, compactBRL, niceCeil, useWidth } from "./RevenueChart";

export interface ChartView {
  id: string;
  label: string;
  series: SeriesPoint[];
}

const HEIGHT = 300;
const MARGIN = { top: 22, right: 18, bottom: 28, left: 64 };
const PAIR_GAP = 3;
const MAX_BAR = 34;
const MIN_LABEL_SPACE = 64;
const TOOLTIP_WIDTH = 188;
const TICK_STEPS = 4;

/** Mistura a cor com branco (`amount` > 0) ou preto (`amount` < 0): faces de cima mais claras, laterais mais escuras. */
function shade(hex: string, amount: number): string {
  const target = amount > 0 ? 255 : 0;
  const ratio = Math.abs(amount);
  const channel = (start: number) => Math.round(Number.parseInt(hex.slice(start, start + 2), 16) * (1 - ratio) + target * ratio);
  return `rgb(${channel(1)}, ${channel(3)}, ${channel(5)})`;
}

const FACES = {
  revenue: { front: SERIES_COLOR.revenue, top: shade(SERIES_COLOR.revenue, 0.35), side: shade(SERIES_COLOR.revenue, -0.4) },
  expenses: { front: SERIES_COLOR.expenses, top: shade(SERIES_COLOR.expenses, 0.35), side: shade(SERIES_COLOR.expenses, -0.4) },
} as const;

type Faces = (typeof FACES)[keyof typeof FACES];

interface Depth {
  dx: number;
  dy: number;
}

const points = (...coords: [number, number][]) => coords.map(([x, y]) => `${x},${y}`).join(" ");

/** Barra com volume: a face da frente mede o valor; topo e lateral só dão profundidade. */
function Bar3D({ x, y, width, base, depth, faces, delay }: { x: number; y: number; width: number; base: number; depth: Depth; faces: Faces; delay: number }) {
  const reduceMotion = useReducedMotion();
  if (base - y <= 0) return null;
  const { dx, dy } = depth;
  return (
    <motion.g
      initial={reduceMotion ? false : { scaleY: 0 }}
      animate={{ scaleY: 1 }}
      transition={{ duration: 0.7, delay, ease: EASE_OUT_EXPO }}
      style={{ originY: 1 }}
    >
      <polygon points={points([x + width, y], [x + width + dx, y + dy], [x + width + dx, base + dy], [x + width, base])} fill={faces.side} />
      <polygon points={points([x, y], [x + width, y], [x + width + dx, y + dy], [x + dx, y + dy])} fill={faces.top} />
      <rect x={x} y={y} width={width} height={base - y} fill={faces.front} />
    </motion.g>
  );
}

function Tooltip({ point, left }: { point: SeriesPoint; left: number }) {
  const result = point.revenue - point.expenses;
  return (
    <div
      role="presentation"
      className="pointer-events-none absolute top-2 z-10 rounded-xl border border-line-strong bg-surface-2/95 px-3 py-2 text-xs shadow-2xl shadow-black/60 backdrop-blur"
      style={{ left, width: TOOLTIP_WIDTH }}
    >
      <p className="font-semibold text-white">{point.label}</p>
      {(["revenue", "expenses"] as const).map((key) => (
        <p key={key} className="mt-1 flex items-center justify-between gap-3 text-fog">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-sm" style={{ background: SERIES_COLOR[key] }} />
            {key === "revenue" ? "Faturamento" : "Despesas"}
          </span>
          <span className="text-white tabular-nums">{formatBRL(point[key])}</span>
        </p>
      ))}
      <p className="mt-1.5 flex items-center justify-between gap-3 border-t border-line pt-1.5 text-fog">
        <span>{result < 0 ? "Prejuízo" : "Resultado"}</span>
        <span className="font-semibold text-white tabular-nums">{formatBRL(Math.abs(result))}</span>
      </p>
    </div>
  );
}

function Plot3D({ series }: { series: SeriesPoint[] }) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  // Quatro faixas de valor redondo (R$ 1 mil, 2 mil...), em vez de quartos de um teto redondo.
  const step = niceCeil(Math.max(...series.map((point) => Math.max(point.revenue, point.expenses)), 0) / TICK_STEPS);
  const max = step * TICK_STEPS;
  const band = series.length ? innerWidth / series.length : 0;
  const barWidth = Math.max(2, Math.min(MAX_BAR, (band * 0.62 - PAIR_GAP) / 2));
  const depthSize = Math.min(14, Math.max(3, barWidth * 0.55));
  const depth: Depth = { dx: depthSize, dy: -depthSize * 0.75 };
  const scaleY = (value: number) => innerHeight - (value / max) * innerHeight;
  const ticks = Array.from({ length: TICK_STEPS + 1 }, (_, index) => index * step);
  const labelEvery = Math.max(1, Math.ceil(series.length / Math.max(2, Math.floor(innerWidth / MIN_LABEL_SPACE))));
  const activePoint = active === null ? null : series[active];
  const stagger = Math.min(0.04, 0.5 / Math.max(series.length, 1));

  return (
    <div ref={ref} className="relative" onMouseLeave={() => setActive(null)}>
      {width > 0 && (
        <svg width={width} height={HEIGHT} role="img" aria-label="Faturamento e despesas por período, em barras com profundidade">
          <defs>
            <linearGradient id="chart3d-wall" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2799ff" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#2799ff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            {/* Parede do fundo e chão: as linhas de grade do fundo ficam na altura do topo de cada barra. */}
            <rect x={depth.dx} y={depth.dy} width={innerWidth} height={innerHeight} fill="url(#chart3d-wall)" />
            <polygon
              points={points([0, innerHeight], [innerWidth, innerHeight], [innerWidth + depth.dx, innerHeight + depth.dy], [depth.dx, innerHeight + depth.dy])}
              className="fill-white/[0.03]"
            />
            {ticks.map((tick) => {
              const y = scaleY(tick);
              return (
                <g key={tick}>
                  <line x1={0} y1={y} x2={depth.dx} y2={y + depth.dy} stroke="currentColor" className="text-line" />
                  <line x1={depth.dx} y1={y + depth.dy} x2={innerWidth + depth.dx} y2={y + depth.dy} stroke="currentColor" className={tick === 0 ? "text-line-strong" : "text-line"} />
                  <text x={-10} y={y} dy="0.32em" textAnchor="end" className="fill-mist text-[11px] tabular-nums">
                    {compactBRL.format(tick / 100)}
                  </text>
                </g>
              );
            })}
            <line x1={0} y1={innerHeight} x2={innerWidth} y2={innerHeight} stroke="currentColor" className="text-line-strong" />

            {series.map((point, index) => {
              const x = index * band + (band - (barWidth * 2 + PAIR_GAP + depth.dx)) / 2;
              return (
                <g key={point.key}>
                  {active === index && <rect x={index * band} y={depth.dy} width={band} height={innerHeight - depth.dy} className="fill-white/[0.05]" />}
                  <Bar3D x={x} y={scaleY(point.revenue)} width={barWidth} base={innerHeight} depth={depth} faces={FACES.revenue} delay={index * stagger} />
                  <Bar3D
                    x={x + barWidth + PAIR_GAP}
                    y={scaleY(point.expenses)}
                    width={barWidth}
                    base={innerHeight}
                    depth={depth}
                    faces={FACES.expenses}
                    delay={index * stagger + 0.05}
                  />
                  {index % labelEvery === 0 && (
                    <text x={index * band + band / 2} y={innerHeight + 18} textAnchor="middle" className="fill-mist text-[11px]">
                      {point.label}
                    </text>
                  )}
                  <rect
                    x={index * band}
                    y={depth.dy}
                    width={band}
                    height={innerHeight - depth.dy}
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
        <Tooltip
          point={activePoint}
          left={Math.min(Math.max(MARGIN.left + active * band + band / 2 - TOOLTIP_WIDTH / 2, 0), Math.max(0, width - TOOLTIP_WIDTH))}
        />
      )}
    </div>
  );
}

function Toggle({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        pressed ? "border-electric bg-electric/15 text-white" : "border-line-strong text-mist hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

/** Faturamento e despesas em barras com profundidade, com troca de período e versão em tabela. */
export function RevenueChart3D({ views }: { views: readonly ChartView[] }) {
  const [viewId, setViewId] = useState(views[0]?.id ?? "");
  const [asTable, setAsTable] = useState(false);
  const view = views.find((item) => item.id === viewId) ?? views[0];
  if (!view) return null;
  const empty = view.series.every((point) => point.revenue === 0 && point.expenses === 0);
  const totals = view.series.reduce((sum, point) => ({ revenue: sum.revenue + point.revenue, expenses: sum.expenses + point.expenses }), {
    revenue: 0,
    expenses: 0,
  });

  return (
    <section aria-labelledby="chart3d-title" className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-b from-surface-2 to-surface/60 p-5 sm:p-6">
      <div aria-hidden className="pointer-events-none absolute -top-24 left-1/3 size-64 rounded-full bg-electric/10 blur-3xl" />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="chart3d-title" className="font-display text-base font-semibold text-white">
            Faturamento e despesas
          </h2>
          <p className="mt-1 text-xs text-mist">
            {view.label}: <span className="text-fog tabular-nums">{formatBRL(totals.revenue)}</span> de entrada,{" "}
            <span className="text-fog tabular-nums">{formatBRL(totals.expenses)}</span> de saída
          </p>
          <div className="mt-3">
            <Legend />
          </div>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Período do gráfico">
          {views.map((item) => (
            <Toggle key={item.id} pressed={item.id === view.id} onClick={() => setViewId(item.id)}>
              {item.label}
            </Toggle>
          ))}
          <Toggle pressed={asTable} onClick={() => setAsTable((value) => !value)}>
            Ver como tabela
          </Toggle>
        </div>
      </div>
      <div className="relative mt-5">
        {asTable ? (
          <ChartTable series={view.series} />
        ) : empty ? (
          <p className="grid h-[300px] place-items-center rounded-2xl border border-dashed border-line-strong text-sm text-mist">
            Nenhum movimento no período.
          </p>
        ) : (
          <Plot3D key={view.id} series={view.series} />
        )}
      </div>
    </section>
  );
}
