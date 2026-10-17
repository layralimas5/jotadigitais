import { rangeOf, toLocalIsoDate, type DateRange } from "./finance";

export const DASHBOARD_PRESETS = [
  "today",
  "yesterday",
  "last_7_days",
  "last_30_days",
  "this_month",
  "last_month",
  "this_year",
  "all",
] as const;
export type DashboardPreset = (typeof DASHBOARD_PRESETS)[number];

export const DASHBOARD_PRESET_LABEL: Record<DashboardPreset, string> = {
  today: "Hoje",
  yesterday: "Ontem",
  last_7_days: "Últimos 7 dias",
  last_30_days: "Últimos 30 dias",
  this_month: "Este mês",
  last_month: "Mês passado",
  this_year: "Este ano",
  all: "Tudo",
};

/** Atalho pronto, um mês do calendário (AAAA-MM) ou um intervalo livre de dias (AAAA-MM-DD, inclusivo). */
export type DashboardPeriod =
  | { kind: "preset"; preset: DashboardPreset }
  | { kind: "month"; month: string }
  | { kind: "custom"; from: string; to: string };

export const DEFAULT_DASHBOARD_PERIOD: DashboardPeriod = { kind: "preset", preset: "this_month" };

/** Como os textos do painel se referem ao período: "Faturamento do mês", "vendas no mês". */
export interface PeriodScope {
  of: string;
  in: string;
}

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

const parseDay = (iso: string) => {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
};

const shiftDays = (iso: string, days: number) => {
  const date = parseDay(iso);
  date.setDate(date.getDate() + days);
  return toLocalIsoDate(date);
};

const daySpan = (from: string, to: string) => Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / 86_400_000) + 1;

function monthRange(month: string): DateRange {
  const [year, index] = month.split("-").map(Number) as [number, number];
  return { from: toLocalIsoDate(new Date(year, index - 1, 1)), to: toLocalIsoDate(new Date(year, index, 0)) };
}

function previousMonthOf(month: string): string {
  const [year, index] = month.split("-").map(Number) as [number, number];
  const date = new Date(year, index - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function presetRange(preset: DashboardPreset, now: Date): DateRange {
  const today = toLocalIsoDate(now);
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "yesterday": {
      const yesterday = shiftDays(today, -1);
      return { from: yesterday, to: yesterday };
    }
    case "last_7_days":
      return { from: shiftDays(today, -6), to: today };
    default:
      return rangeOf(preset, now);
  }
}

export function dashboardRangeOf(period: DashboardPeriod, now: Date = new Date()): DateRange {
  switch (period.kind) {
    case "preset":
      return presetRange(period.preset, now);
    case "month":
      return monthRange(period.month);
    case "custom":
      return { from: period.from, to: period.to };
  }
}

/** Mesmo tamanho de período, logo antes. Mês compara com o mês anterior inteiro e ano com o ano anterior. */
export function previousRangeOf(period: DashboardPeriod, now: Date = new Date()): DateRange | null {
  if (period.kind === "month") return monthRange(previousMonthOf(period.month));
  if (period.kind === "preset") {
    if (period.preset === "all") return null;
    if (period.preset === "this_month") return rangeOf("last_month", now);
    if (period.preset === "last_month") return monthRange(previousMonthOf(previousMonthOf(toLocalIsoDate(now).slice(0, 7))));
    if (period.preset === "this_year") {
      const year = now.getFullYear() - 1;
      return { from: `${year}-01-01`, to: `${year}-12-31` };
    }
  }
  const range = dashboardRangeOf(period, now);
  if (range.from === null) return null;
  const length = daySpan(range.from, range.to);
  return { from: shiftDays(range.from, -length), to: shiftDays(range.from, -1) };
}

/** Nome curto do período comparado, para "mês anterior R$ 1.200,00". */
export function comparisonLabelOf(period: DashboardPeriod): string | null {
  if (period.kind === "month") return "mês anterior";
  if (period.kind === "custom") return "período anterior";
  switch (period.preset) {
    case "today":
      return "ontem";
    case "yesterday":
      return "dia anterior";
    case "this_month":
      return "mês passado";
    case "last_month":
      return "mês anterior";
    case "this_year":
      return "ano passado";
    case "all":
      return null;
    default:
      return "período anterior";
  }
}

export function scopeOf(period: DashboardPeriod): PeriodScope {
  if (period.kind === "month") return { of: "do mês", in: "no mês" };
  if (period.kind === "custom") return { of: "do período", in: "no período" };
  switch (period.preset) {
    case "today":
      return { of: "de hoje", in: "hoje" };
    case "yesterday":
      return { of: "de ontem", in: "ontem" };
    case "this_month":
    case "last_month":
      return { of: "do mês", in: "no mês" };
    case "this_year":
      return { of: "do ano", in: "no ano" };
    case "all":
      return { of: "total", in: "no total" };
    default:
      return { of: "do período", in: "no período" };
  }
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const monthFormat = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const dayFormat = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" });
const dayYearFormat = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric" });

const formatDay = (iso: string, withYear: boolean) => (withYear ? dayYearFormat : dayFormat).format(parseDay(iso)).replace(/\./g, "");

/** Texto do botão do filtro: "Outubro de 2026", "Últimos 7 dias", "3 out – 15 out 2026". */
export function periodLabelOf(period: DashboardPeriod, now: Date = new Date()): string {
  if (period.kind === "month") return capitalize(monthFormat.format(parseDay(`${period.month}-01`)));
  if (period.kind === "custom") {
    if (period.from === period.to) return formatDay(period.from, true);
    const sameYear = period.from.slice(0, 4) === period.to.slice(0, 4);
    return `${formatDay(period.from, !sameYear)} – ${formatDay(period.to, true)}`;
  }
  if (period.preset === "this_month") return capitalize(monthFormat.format(now));
  return DASHBOARD_PRESET_LABEL[period.preset];
}

/** Guarda o filtro na URL (?periodo=...) para sobreviver a recarregar e poder ser compartilhado. */
export function serializePeriod(period: DashboardPeriod): string {
  switch (period.kind) {
    case "preset":
      return period.preset;
    case "month":
      return period.month;
    case "custom":
      return `${period.from}_${period.to}`;
  }
}

export function parsePeriod(value: string | null): DashboardPeriod {
  if (!value) return DEFAULT_DASHBOARD_PERIOD;
  if ((DASHBOARD_PRESETS as readonly string[]).includes(value)) return { kind: "preset", preset: value as DashboardPreset };
  if (MONTH_PATTERN.test(value)) return { kind: "month", month: value };
  const [from, to] = value.split("_");
  if (from && to && DAY_PATTERN.test(from) && DAY_PATTERN.test(to) && from <= to) return { kind: "custom", from, to };
  return DEFAULT_DASHBOARD_PERIOD;
}

export const samePeriod = (a: DashboardPeriod, b: DashboardPeriod) => serializePeriod(a) === serializePeriod(b);
