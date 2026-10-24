import { ArrowDownLeft, ArrowUpRight, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadFinance } from "@/application/admin-use-cases";
import {
  EXPENSE_CATEGORY_LABEL,
  REVENUE_CATEGORY_LABEL,
  REVENUE_ORIGIN_LABEL,
  entriesOf,
  isInflow,
  summarizeFinance,
  type Entry,
  type FinanceSummary,
} from "@/domain/finance";
import { PAYMENT_PLAN_LABEL } from "@/domain/payment";
import { dashboardRangeOf } from "@/domain/dashboard-period";
import { formatBRL } from "@/domain/money";
import { ButtonLink } from "@/ui/components/Button";
import { ErrorState } from "@/ui/components/StateViews";
import { cn } from "@/ui/lib/cn";
import { LoadingBlock, PageHeader } from "../components/AdminUi";
import { FilterChips } from "../components/FilterChips";
import { Kpi } from "../components/Kpi";
import { DashboardPeriodPicker } from "../dashboard/DashboardPeriodPicker";
import { useDashboardPeriod } from "../dashboard/useDashboardPeriod";
import { RevenueChart, SERIES_COLOR } from "../finance/RevenueChart";
import { useAdminQuery } from "../hooks";
import { formatIsoDate } from "../lib/dates";

const MAX_ENTRIES = 30;

const countLabel = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function Kpis({ summary }: { summary: FinanceSummary }) {
  const profitTone = summary.profit > 0 ? "positive" : summary.profit < 0 ? "negative" : undefined;
  const revenueHint = [
    countLabel(summary.paidOrders, "pedido do site", "pedidos do site"),
    summary.manualRevenues > 0 ? countLabel(summary.manualRevenues, "lançada", "lançadas") : null,
  ]
    .filter(Boolean)
    .join(" + ");
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5 [&>div:last-child]:col-span-2 lg:[&>div:last-child]:col-span-1">
      <Kpi label="Receitas" value={formatBRL(summary.revenue)} hint={revenueHint} />
      <Kpi label="Despesas" value={formatBRL(summary.expenses)} />
      <Kpi label={summary.profit < 0 ? "Prejuízo" : "Lucro"} value={formatBRL(Math.abs(summary.profit))} hint="Receitas menos despesas" tone={profitTone} />
      <Kpi label="Ticket médio do site" value={formatBRL(summary.averageTicket)} />
      <Kpi label="A receber" value={formatBRL(summary.receivable)} hint={`${summary.receivableOrders} aguardando pagamento`} />
    </dl>
  );
}

/** Barras horizontais simples: quanto cada parte pesa no total. */
function Breakdown({ title, rows, color, empty }: { title: string; rows: { label: string; amount: number }[]; color: string; empty: string }) {
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  return (
    <section aria-label={title} className="rounded-3xl border border-line bg-surface/60 p-5 sm:p-6">
      <h2 className="font-display text-base font-semibold text-white">{title}</h2>
      {total === 0 ? (
        <p className="mt-4 text-sm text-mist">{empty}</p>
      ) : (
        <ul className="mt-4 space-y-3.5">
          {rows.map((row) => {
            const share = row.amount / total;
            return (
              <li key={row.label}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-fog">{row.label}</span>
                  <span className="text-white tabular-nums">
                    {formatBRL(row.amount)} <span className="text-xs text-mist">{Math.round(share * 100)}%</span>
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/[0.05]">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(share * 100, 2)}%`, background: color }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

interface EntryView {
  title: string;
  detail: string;
  /** Pedido do site não abre editor: o status muda na aba Pedidos. */
  editPath: string | null;
}

function viewOf(entry: Entry): EntryView {
  switch (entry.kind) {
    case "order":
      return {
        title: `Pedido ${entry.order.code}`,
        detail: `Site · ${entry.order.customer.name} · ${PAYMENT_PLAN_LABEL[entry.order.paymentMethod]}`,
        editPath: null,
      };
    case "revenue":
      return {
        title: entry.revenue.description,
        detail: REVENUE_CATEGORY_LABEL[entry.revenue.category],
        editPath: `/admin/financeiro/receitas/${entry.revenue.id}`,
      };
    case "expense":
      return {
        title: entry.expense.description,
        detail: EXPENSE_CATEGORY_LABEL[entry.expense.category],
        editPath: `/admin/financeiro/despesas/${entry.expense.id}`,
      };
  }
}

function EntryRow({ entry }: { entry: Entry }) {
  const inflow = isInflow(entry);
  const { title, detail, editPath } = viewOf(entry);
  const color = inflow ? SERIES_COLOR.revenue : SERIES_COLOR.expenses;
  const body = (
    <>
      <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-xl" style={{ background: `${color}26`, color }}>
        {inflow ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-white">{title}</span>
        <span className="block truncate text-xs text-mist">
          {formatIsoDate(entry.date)} · {detail}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block font-semibold text-white tabular-nums">
          {inflow ? "+" : "−"} {formatBRL(entry.amount)}
        </span>
        <span className="block text-xs text-mist">{inflow ? "Receita" : "Despesa"}</span>
      </span>
    </>
  );
  const rowClass = "flex items-center gap-3 px-4 py-3 sm:px-5";
  return (
    <li>
      {editPath ? (
        <Link to={editPath} className={cn(rowClass, "transition-colors hover:bg-white/[0.03]")}>
          {body}
        </Link>
      ) : (
        <div className={rowClass}>{body}</div>
      )}
    </li>
  );
}

type EntryFilter = "all" | "inflow" | "outflow";

const EMPTY_MESSAGE: Record<EntryFilter, string> = {
  all: "Nenhuma receita ou despesa no período. Pedidos pagos entram sozinhos; o resto você lança nos botões do topo.",
  inflow: "Nenhuma receita no período. Pedidos pagos do site entram sozinhos; vendas por fora você lança em Nova receita.",
  outflow: "Nenhuma despesa no período. Lance em Nova despesa.",
};

const matchesFilter = (entry: Entry, filter: EntryFilter) =>
  filter === "all" || (filter === "inflow" ? isInflow(entry) : !isInflow(entry));

const sumOf = (entries: readonly Entry[]) => entries.reduce((sum, entry) => sum + entry.amount, 0);

function Entries({ entries }: { entries: Entry[] }) {
  const [filter, setFilter] = useState<EntryFilter>("all");
  const [showAll, setShowAll] = useState(false);
  const inflows = entries.filter(isInflow);
  const outflows = entries.filter((entry) => !isInflow(entry));
  const filtered = entries.filter((entry) => matchesFilter(entry, filter));
  const shown = showAll ? filtered : filtered.slice(0, MAX_ENTRIES);

  return (
    <section aria-labelledby="lancamentos-title" className="space-y-3">
      <h2 id="lancamentos-title" className="font-display text-lg font-semibold text-white">
        Lançamentos
      </h2>
      <FilterChips<EntryFilter>
        label="Mostrar lançamentos"
        value={filter}
        onChange={(next) => {
          setFilter(next);
          setShowAll(false);
        }}
        options={[
          { value: "all", label: "Tudo", count: entries.length },
          { value: "inflow", label: `Receitas · ${formatBRL(sumOf(inflows))}`, count: inflows.length },
          { value: "outflow", label: `Despesas · ${formatBRL(sumOf(outflows))}`, count: outflows.length },
        ]}
      />
      {filtered.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-line-strong p-6 text-center text-sm text-mist">{EMPTY_MESSAGE[filter]}</p>
      ) : (
        <>
          <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface/40">
            {shown.map((entry) => (
              <EntryRow key={`${entry.kind}-${entry.id}`} entry={entry} />
            ))}
          </ul>
          {filtered.length > shown.length && (
            <button type="button" onClick={() => setShowAll(true)} className="text-sm text-electric-soft underline-offset-4 hover:underline">
              Ver todos os {filtered.length} lançamentos
            </button>
          )}
        </>
      )}
    </section>
  );
}

function HeaderActions() {
  return (
    <div className="flex flex-wrap gap-2">
      <ButtonLink to="/admin/financeiro/receitas/nova" className="max-sm:flex-1">
        <Plus aria-hidden className="size-4" /> Nova receita
      </ButtonLink>
      <ButtonLink to="/admin/financeiro/despesas/nova" variant="secondary" className="max-sm:flex-1">
        <Plus aria-hidden className="size-4" /> Nova despesa
      </ButtonLink>
    </div>
  );
}

export default function FinancePage() {
  const finance = useAdminQuery(loadFinance, "admin-finance");
  const [period, setPeriod] = useDashboardPeriod();
  const range = useMemo(() => dashboardRangeOf(period), [period]);
  const data = finance.status === "success" ? finance.data : null;
  const summary = useMemo(() => (data ? summarizeFinance(data, range) : null), [data, range]);
  const entries = useMemo(() => (data ? entriesOf(data, range) : []), [data, range]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financeiro"
        description="Receitas: pedidos pagos do site e o que você lança por fora. Despesas: o que você lança."
        action={<HeaderActions />}
      />
      <DashboardPeriodPicker value={period} onChange={setPeriod} align="start" label="Período do financeiro" />

      {finance.status === "loading" && <LoadingBlock />}
      {finance.status === "error" && <ErrorState message={finance.error.message} onRetry={finance.reload} />}
      {summary && (
        <>
          <Kpis summary={summary} />
          <RevenueChart series={summary.series} />
          <div className="grid gap-4 lg:grid-cols-2">
            <Breakdown
              title="Receitas por origem"
              color={SERIES_COLOR.revenue}
              empty="Nenhuma receita no período."
              rows={summary.byOrigin.map((row) => ({ label: REVENUE_ORIGIN_LABEL[row.origin], amount: row.amount }))}
            />
            <Breakdown
              title="Despesas por categoria"
              color={SERIES_COLOR.expenses}
              empty="Nenhuma despesa lançada no período."
              rows={summary.byCategory.map((row) => ({ label: EXPENSE_CATEGORY_LABEL[row.category], amount: row.amount }))}
            />
          </div>
          <Entries entries={entries} />
        </>
      )}
    </div>
  );
}
