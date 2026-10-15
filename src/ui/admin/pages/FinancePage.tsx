import { ArrowDownLeft, ArrowUpRight, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadFinance } from "@/application/admin-use-cases";
import {
  EXPENSE_CATEGORY_LABEL,
  entriesOf,
  rangeOf,
  summarizeFinance,
  type Entry,
  type FinanceSummary,
  type PeriodPreset,
} from "@/domain/finance";
import { formatBRL } from "@/domain/money";
import { ButtonLink } from "@/ui/components/Button";
import { ErrorState } from "@/ui/components/StateViews";
import { cn } from "@/ui/lib/cn";
import { Fab, LoadingBlock, PageHeader } from "../components/AdminUi";
import { Kpi } from "../components/Kpi";
import { PeriodFilter } from "../components/PeriodFilter";
import { RevenueChart, SERIES_COLOR } from "../finance/RevenueChart";
import { useAdminQuery } from "../hooks";
import { formatIsoDate } from "../lib/dates";

const PAYMENT_LABEL = { pix: "Pix", card: "Cartão" } as const;
const MAX_ENTRIES = 30;

function Kpis({ summary }: { summary: FinanceSummary }) {
  const profitTone = summary.profit > 0 ? "positive" : summary.profit < 0 ? "negative" : undefined;
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5 [&>div:last-child]:col-span-2 lg:[&>div:last-child]:col-span-1">
      <Kpi label="Faturamento" value={formatBRL(summary.revenue)} hint={`${summary.paidOrders} ${summary.paidOrders === 1 ? "pedido pago" : "pedidos pagos"}`} />
      <Kpi label="Despesas" value={formatBRL(summary.expenses)} />
      <Kpi label={summary.profit < 0 ? "Prejuízo" : "Lucro"} value={formatBRL(Math.abs(summary.profit))} hint="Faturamento menos despesas" tone={profitTone} />
      <Kpi label="Ticket médio" value={formatBRL(summary.averageTicket)} />
      <Kpi
        label="A receber"
        value={formatBRL(summary.receivable)}
        hint={`${summary.receivableOrders} aguardando pagamento`}
      />
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

function EntryRow({ entry }: { entry: Entry }) {
  const isRevenue = entry.kind === "revenue";
  const title = isRevenue ? `Pedido ${entry.order.code}` : entry.expense.description;
  const detail = isRevenue
    ? `${entry.order.customer.name} · ${entry.order.accountHandle} · ${PAYMENT_LABEL[entry.order.paymentMethod]}`
    : EXPENSE_CATEGORY_LABEL[entry.expense.category];
  const body = (
    <>
      <span
        aria-hidden
        className="grid size-9 shrink-0 place-items-center rounded-xl"
        style={{ background: `${isRevenue ? SERIES_COLOR.revenue : SERIES_COLOR.expenses}26`, color: isRevenue ? SERIES_COLOR.revenue : SERIES_COLOR.expenses }}
      >
        {isRevenue ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-white">{title}</span>
        <span className="block truncate text-xs text-mist">
          {formatIsoDate(entry.date)} · {detail}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block font-semibold text-white tabular-nums">
          {isRevenue ? "+" : "−"} {formatBRL(entry.amount)}
        </span>
        <span className="block text-xs text-mist">{isRevenue ? "Entrada" : "Saída"}</span>
      </span>
    </>
  );
  const rowClass = "flex items-center gap-3 px-4 py-3 sm:px-5";
  return (
    <li>
      {isRevenue ? (
        <div className={rowClass}>{body}</div>
      ) : (
        <Link to={`/admin/financeiro/despesas/${entry.expense.id}`} className={cn(rowClass, "transition-colors hover:bg-white/[0.03]")}>
          {body}
        </Link>
      )}
    </li>
  );
}

function Entries({ entries }: { entries: Entry[] }) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? entries : entries.slice(0, MAX_ENTRIES);
  return (
    <section aria-labelledby="lancamentos-title">
      <h2 id="lancamentos-title" className="font-display text-lg font-semibold text-white">
        Lançamentos
      </h2>
      {entries.length === 0 ? (
        <p className="mt-3 rounded-3xl border border-dashed border-line-strong p-6 text-center text-sm text-mist">
          Nenhuma entrada ou saída no período. Pedidos pagos entram sozinhos; despesas você lança em “Nova despesa”.
        </p>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface/40">
            {shown.map((entry) => (
              <EntryRow key={`${entry.kind}-${entry.id}`} entry={entry} />
            ))}
          </ul>
          {entries.length > shown.length && (
            <button type="button" onClick={() => setShowAll(true)} className="mt-3 text-sm text-electric-soft underline-offset-4 hover:underline">
              Ver todos os {entries.length} lançamentos
            </button>
          )}
        </>
      )}
    </section>
  );
}

export default function FinancePage() {
  const finance = useAdminQuery(loadFinance, "admin-finance");
  const [period, setPeriod] = useState<PeriodPreset>("this_month");
  const range = useMemo(() => rangeOf(period), [period]);
  const data = finance.status === "success" ? finance.data : null;
  const summary = useMemo(() => (data ? summarizeFinance(data.orders, data.expenses, range) : null), [data, range]);
  const entries = useMemo(() => (data ? entriesOf(data.orders, data.expenses, range) : []), [data, range]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financeiro"
        description="Entradas pelos pedidos pagos, na data do pedido. Saídas pelas despesas que você lança."
        action={
          <ButtonLink to="/admin/financeiro/despesas/nova" className="max-md:hidden">
            <Plus aria-hidden className="size-4" /> Nova despesa
          </ButtonLink>
        }
      />
      <PeriodFilter value={period} onChange={setPeriod} />

      {finance.status === "loading" && <LoadingBlock />}
      {finance.status === "error" && <ErrorState message={finance.error.message} onRetry={finance.reload} />}
      {summary && (
        <>
          <Kpis summary={summary} />
          <RevenueChart series={summary.series} />
          <div className="grid gap-4 lg:grid-cols-2">
            <Breakdown
              title="Por forma de pagamento"
              color={SERIES_COLOR.revenue}
              empty="Nenhum pedido pago no período."
              rows={[
                { label: "Pix", amount: summary.byMethod.pix },
                { label: "Cartão", amount: summary.byMethod.card },
              ]}
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
      <Fab to="/admin/financeiro/despesas/nova" label="Nova despesa" />
    </div>
  );
}
