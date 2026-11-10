import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { SUPPORT_STATUS_LABEL } from "@/domain/support-ticket";
import type { CountOf, OpenStatus, SupportWeek } from "@/domain/support-overview";
import { cn } from "@/ui/lib/cn";
import { EASE_OUT_EXPO } from "@/ui/lib/motion";
import { useWidth } from "../finance/RevenueChart";

/** Validadas contra o fundo do painel (#0c0c14): faixa de luminosidade, daltonismo e contraste. */
export const STATUS_CHART_COLOR: Record<OpenStatus, string> = { open: "#d34d9c", in_progress: "#228ef0", waiting: "#c08410" };
const WEEK_COLOR = { opened: "#d34d9c", resolved: "#228ef0" } as const;
const WEEK_LABEL = { opened: "Abertos", resolved: "Finalizados" } as const;
type WeekSeries = keyof typeof WEEK_COLOR;
const WEEK_SERIES: readonly WeekSeries[] = ["opened", "resolved"];

const shortDay = (iso: string) => {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(year ?? 0, (month ?? 1) - 1, day ?? 1)).replace(".", "");
};
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function LegendSwatch({ color }: { color: string }) {
  return <span aria-hidden className="size-2.5 shrink-0 rounded-sm" style={{ background: color }} />;
}

// ---------------------------------------------------------------------------
// Ritmo por semana
// ---------------------------------------------------------------------------

const HEIGHT = 230;
const MARGIN = { top: 14, right: 4, bottom: 26, left: 26 };
const MAX_BAR = 20;
const PAIR_GAP = 2;
const RADIUS = 4;
const TICKS = 4;

/** Barra com as pontas de cima arredondadas e a base reta, presa no eixo. */
function barPath(x: number, y: number, width: number, base: number): string {
  const r = Math.min(RADIUS, width / 2, base - y);
  return `M${x},${base}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${base}Z`;
}

function WeekTooltip({ week, left }: { week: SupportWeek; left: number }) {
  return (
    <div
      role="presentation"
      className="pointer-events-none absolute top-0 z-10 w-40 -translate-x-1/2 rounded-xl border border-line-strong bg-surface-2/95 px-3 py-2 text-xs shadow-xl backdrop-blur"
      style={{ left }}
    >
      <p className="font-medium text-white">Semana de {shortDay(week.start)}</p>
      {WEEK_SERIES.map((series) => (
        <p key={series} className="mt-1 flex items-center justify-between gap-3 text-fog">
          <span className="flex items-center gap-2">
            <LegendSwatch color={WEEK_COLOR[series]} /> {WEEK_LABEL[series]}
          </span>
          <span className="font-semibold text-white tabular-nums">{week[series]}</span>
        </p>
      ))}
    </div>
  );
}

function WeeksTable({ weeks }: { weeks: SupportWeek[] }) {
  return (
    <table className="sr-only">
      <caption>Chamados abertos e finalizados por semana</caption>
      <thead>
        <tr>
          <th scope="col">Semana</th>
          <th scope="col">Abertos</th>
          <th scope="col">Finalizados</th>
        </tr>
      </thead>
      <tbody>
        {weeks.map((week) => (
          <tr key={week.start}>
            <th scope="row">{shortDay(week.start)}</th>
            <td>{week.opened}</td>
            <td>{week.resolved}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Abertos x finalizados nas últimas semanas: mostra se a fila está crescendo ou andando. */
export function WeeklyChart({ weeks }: { weeks: SupportWeek[] }) {
  const reduceMotion = useReducedMotion();
  const { ref, width } = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const totals = { opened: weeks.reduce((sum, week) => sum + week.opened, 0), resolved: weeks.reduce((sum, week) => sum + week.resolved, 0) };

  const peak = Math.max(1, ...weeks.flatMap((week) => [week.opened, week.resolved]));
  const step = Math.max(1, Math.ceil(peak / TICKS));
  const top = step * TICKS;
  const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const band = weeks.length ? plotWidth / weeks.length : 0;
  const bar = Math.max(4, Math.min(MAX_BAR, (band * 0.62 - PAIR_GAP) / 2));
  const base = HEIGHT - MARGIN.bottom;
  const y = (value: number) => base - (value / top) * (base - MARGIN.top);
  const showEvery = band < 44 ? 2 : 1;

  return (
    <div className="rounded-2xl border border-line bg-surface/70 p-4 sm:p-5">
      <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-fog">
        {WEEK_SERIES.map((series) => (
          <li key={series} className="flex items-center gap-2">
            <LegendSwatch color={WEEK_COLOR[series]} />
            {WEEK_LABEL[series]}
            <span className="font-semibold text-white tabular-nums">{totals[series]}</span>
          </li>
        ))}
        <li className="text-mist">nas últimas {weeks.length} semanas</li>
      </ul>

      {/* O SVG fica por cima de uma caixa de altura fixa: quem dá a largura é o card, nunca o próprio gráfico. */}
      <div ref={ref} className="relative mt-4 w-full min-w-0" style={{ height: HEIGHT }} onMouseLeave={() => setActive(null)}>
        {width > 0 && (
          <svg width={width} height={HEIGHT} className="absolute inset-0 overflow-visible" role="img" aria-label={`Abertos e finalizados por semana. ${plural(totals.opened, "aberto", "abertos")} e ${plural(totals.resolved, "finalizado", "finalizados")}.`}>
            {Array.from({ length: TICKS + 1 }, (_, index) => {
              const value = step * index;
              return (
                <g key={value}>
                  <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(value)} y2={y(value)} stroke="currentColor" className={index === 0 ? "text-line-strong" : "text-line"} strokeDasharray={index === 0 ? undefined : "2 4"} />
                  <text x={MARGIN.left - 8} y={y(value)} dy="0.32em" textAnchor="end" className="fill-mist text-[10px] tabular-nums">
                    {value}
                  </text>
                </g>
              );
            })}
            {weeks.map((week, index) => {
              const center = MARGIN.left + band * index + band / 2;
              const left = center - bar - PAIR_GAP / 2;
              const highlighted = active === index;
              return (
                <g
                  key={week.start}
                  tabIndex={0}
                  aria-label={`Semana de ${shortDay(week.start)}: ${plural(week.opened, "aberto", "abertos")}, ${plural(week.resolved, "finalizado", "finalizados")}`}
                  onMouseEnter={() => setActive(index)}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                  className="outline-none"
                >
                  <rect x={MARGIN.left + band * index} y={MARGIN.top} width={band} height={base - MARGIN.top} rx={8} className={cn("transition-colors", highlighted ? "fill-white/[0.05]" : "fill-transparent")} />
                  {WEEK_SERIES.map((series, position) => {
                    const value = week[series];
                    if (value === 0) return null;
                    return (
                      <motion.path
                        key={series}
                        d={barPath(left + position * (bar + PAIR_GAP), y(value), bar, base)}
                        fill={WEEK_COLOR[series]}
                        initial={reduceMotion ? false : { scaleY: 0 }}
                        animate={{ scaleY: 1, opacity: active === null || highlighted ? 1 : 0.45 }}
                        transition={{ duration: 0.7, delay: reduceMotion ? 0 : index * 0.04, ease: EASE_OUT_EXPO }}
                        style={{ originY: 1, transformBox: "fill-box" }}
                      />
                    );
                  })}
                  {index % showEvery === 0 && (
                    <text x={center} y={HEIGHT - 8} textAnchor="middle" className={cn("text-[10px]", highlighted ? "fill-white" : "fill-mist")}>
                      {shortDay(week.start)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}
        {active !== null && weeks[active] && (
          <WeekTooltip week={weeks[active]} left={Math.min(Math.max(MARGIN.left + band * active + band / 2, 80), width - 80)} />
        )}
      </div>
      <WeeksTable weeks={weeks} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Em aberto por situação
// ---------------------------------------------------------------------------

const DONUT = 176;
const STROKE = 20;
const DONUT_RADIUS = (DONUT - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;
/** Fresta da cor do fundo entre as fatias. */
const SLICE_GAP = 3;

/** Rosca das situações em aberto, com o total no meio e a legenda com número e porcentagem. */
export function StatusDonut({ items }: { items: CountOf<OpenStatus>[] }) {
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState<OpenStatus | null>(null);
  const total = items.reduce((sum, item) => sum + item.count, 0);
  const shown = active ? items.find((item) => item.key === active) : undefined;
  const slices = items.filter((item) => item.count > 0);
  const gap = slices.length > 1 ? SLICE_GAP : 0;

  let offset = 0;
  const arcs = slices.map((item) => {
    const length = (item.count / Math.max(total, 1)) * CIRCUMFERENCE;
    const arc = { item, start: offset, length: Math.max(0, length - gap) };
    offset += length;
    return arc;
  });

  return (
    <div className="flex flex-col items-center gap-6 rounded-2xl border border-line bg-surface/70 p-4 sm:flex-row sm:p-5 lg:flex-col">
      <div className="relative shrink-0" style={{ width: DONUT, height: DONUT }}>
        <svg width={DONUT} height={DONUT} viewBox={`0 0 ${DONUT} ${DONUT}`} role="img" aria-label={`${plural(total, "chamado em aberto", "chamados em aberto")}`} className="-rotate-90">
          <circle cx={DONUT / 2} cy={DONUT / 2} r={DONUT_RADIUS} fill="none" stroke="currentColor" strokeWidth={STROKE} className="text-white/[0.06]" />
          {arcs.map(({ item, start, length }, index) => (
            <motion.circle
              key={item.key}
              cx={DONUT / 2}
              cy={DONUT / 2}
              r={DONUT_RADIUS}
              fill="none"
              stroke={STATUS_CHART_COLOR[item.key]}
              strokeWidth={active === item.key ? STROKE + 4 : STROKE}
              strokeDashoffset={-start}
              initial={reduceMotion ? false : { strokeDasharray: `0 ${CIRCUMFERENCE}` }}
              animate={{ strokeDasharray: `${length} ${CIRCUMFERENCE}`, opacity: active === null || active === item.key ? 1 : 0.35 }}
              transition={{ duration: 0.9, delay: reduceMotion ? 0 : 0.15 + index * 0.12, ease: EASE_OUT_EXPO }}
              onMouseEnter={() => setActive(item.key)}
              onMouseLeave={() => setActive(null)}
              className="cursor-pointer"
            />
          ))}
        </svg>
        <div aria-hidden className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          <span className="font-display text-3xl font-semibold text-white tabular-nums">{shown ? shown.count : total}</span>
          <span className="mt-0.5 max-w-24 text-xs leading-tight text-mist">{shown ? SUPPORT_STATUS_LABEL[shown.key] : total === 0 ? "nada em aberto" : "em aberto"}</span>
        </div>
      </div>

      <ul aria-label="Em aberto por situação" className="w-full min-w-0 space-y-1">
        {items.map((item) => {
          const share = total ? Math.round((item.count / total) * 100) : 0;
          return (
            <li key={item.key}>
              <button
                type="button"
                onMouseEnter={() => setActive(item.key)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(item.key)}
                onBlur={() => setActive(null)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-electric",
                  active === item.key ? "bg-white/[0.06]" : "hover:bg-white/[0.04]",
                )}
              >
                <LegendSwatch color={STATUS_CHART_COLOR[item.key]} />
                <span className="min-w-0 flex-1 truncate text-sm text-fog">{SUPPORT_STATUS_LABEL[item.key]}</span>
                <span className="text-sm font-semibold text-white tabular-nums">{item.count}</span>
                <span className="w-10 text-right text-xs text-mist tabular-nums">{share}%</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
