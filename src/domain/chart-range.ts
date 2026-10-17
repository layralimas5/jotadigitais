import type { DashboardSource } from "./dashboard";
import { dashboardRangeOf, periodLabelOf, type DashboardPeriod } from "./dashboard-period";
import { summarizeFinance, toLocalIsoDate, type DateRange, type Granularity, type SeriesGrouping, type SeriesPoint } from "./finance";

export const CHART_RANGES = ["last_7_days", "last_30_days", "last_3_months", "last_6_months", "last_12_months", "this_year"] as const;
export type ChartRange = (typeof CHART_RANGES)[number];

const CHART_RANGE_LABEL: Record<ChartRange, string> = {
  last_7_days: "7 dias",
  last_30_days: "30 dias",
  last_3_months: "3 meses",
  last_6_months: "6 meses",
  last_12_months: "12 meses",
  this_year: "Este ano",
};

/** Opção de período do gráfico, já com as barras calculadas. */
export interface ChartView {
  id: string;
  label: string;
  /** Diária quando o período cabe em um ano; aí dá para agrupar em semanas ou meses. */
  series: SeriesPoint[];
  granularity: Granularity;
  defaultGrouping: SeriesGrouping;
}

/** Mais que isso de barras diárias vira um pente ilegível: o gráfico pede semana ou mês. */
export const MAX_DAILY_BARS = 62;
const MAX_WEEKLY_DAYS = 180;
const MAX_DAILY_SERIES_DAYS = 366;

const dayDiff = (from: string, to: string) => {
  const toTime = (iso: string) => {
    const [year, month, day] = iso.split("-").map(Number);
    return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1).getTime();
  };
  return Math.round((toTime(to) - toTime(from)) / 86_400_000) + 1;
};

function chartRangeOf(range: ChartRange, now: Date): DateRange {
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = toLocalIsoDate(now);
  const monthsBack = (count: number) => toLocalIsoDate(new Date(year, month - (count - 1), 1));
  switch (range) {
    case "last_7_days":
      return { from: toLocalIsoDate(new Date(year, month, now.getDate() - 6)), to: today };
    case "last_30_days":
      return { from: toLocalIsoDate(new Date(year, month, now.getDate() - 29)), to: today };
    case "last_3_months":
      return { from: monthsBack(3), to: today };
    case "last_6_months":
      return { from: monthsBack(6), to: today };
    case "last_12_months":
      return { from: monthsBack(12), to: today };
    case "this_year":
      return { from: `${year}-01-01`, to: today };
  }
}

/** Agrupamento que deixa o gráfico legível de cara para o tamanho do período. */
export function defaultGroupingFor(days: number): SeriesGrouping {
  if (days <= MAX_DAILY_BARS) return "day";
  return days <= MAX_WEEKLY_DAYS ? "week" : "month";
}

function viewOf(source: DashboardSource, id: string, label: string, range: DateRange, now: Date): ChartView {
  const days = range.from ? dayDiff(range.from, range.to) : Number.POSITIVE_INFINITY;
  const granularity: Granularity = days <= MAX_DAILY_SERIES_DAYS ? "day" : "month";
  const summary = summarizeFinance(source.orders, source.expenses, range, now, granularity);
  return { id, label, series: summary.series, granularity, defaultGrouping: granularity === "day" ? defaultGroupingFor(days) : "month" };
}

/** Períodos fixos do gráfico e, na frente, o período escolhido no filtro do dashboard. */
export function buildChartViews(source: DashboardSource, period: DashboardPeriod, now: Date = new Date()): ChartView[] {
  const fixed = CHART_RANGES.map((range) => viewOf(source, range, CHART_RANGE_LABEL[range], chartRangeOf(range, now), now));
  const selected = viewOf(source, "period", `Filtro: ${periodLabelOf(period, now)}`, dashboardRangeOf(period, now), now);
  return [selected, ...fixed];
}
