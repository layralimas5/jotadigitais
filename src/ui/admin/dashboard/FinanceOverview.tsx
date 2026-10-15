import { ArrowDownRight, ArrowUpRight, HandCoins, Receipt, TrendingUp, Wallet } from "lucide-react";
import type { Dashboard } from "@/domain/dashboard";
import type { SeriesPoint } from "@/domain/finance";
import { formatBRL } from "@/domain/money";
import { StatCard } from "./StatCard";

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** Mini barras do faturamento diário: dá o ritmo do mês sem disputar com o gráfico principal. */
function Sparkline({ series }: { series: SeriesPoint[] }) {
  const max = Math.max(...series.map((point) => point.revenue), 1);
  return (
    <div aria-hidden className="flex h-12 items-end gap-[3px]">
      {series.map((point) => (
        <span
          key={point.key}
          className="flex-1 rounded-t-[2px] bg-electric/70"
          style={{ height: `${Math.max((point.revenue / max) * 100, point.revenue > 0 ? 8 : 3)}%`, opacity: point.revenue > 0 ? 1 : 0.25 }}
        />
      ))}
    </div>
  );
}

function RevenueHighlight({ dashboard }: { dashboard: Dashboard }) {
  const { month, previousMonth, last30Days } = dashboard;
  return (
    <div className="col-span-2 rounded-3xl bg-gradient-to-br from-electric/60 via-violet/50 to-pink/50 p-px lg:row-span-2">
      <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(1.5rem-1px)] bg-surface p-5 sm:p-6">
        <div aria-hidden className="pointer-events-none absolute -top-20 -right-16 size-56 rounded-full bg-electric/15 blur-3xl" />
        <div className="relative flex items-center gap-2">
          <TrendingUp aria-hidden className="size-4 text-electric-soft" />
          <dt className="text-sm font-medium text-fog">Faturamento do mês</dt>
        </div>
        <dd className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white tabular-nums sm:text-5xl">
          {formatBRL(month.revenue)}
        </dd>
        <dd className="relative mt-2 text-sm text-mist">
          {plural(month.paidOrders, "pedido pago", "pedidos pagos")} · mês passado {formatBRL(previousMonth.revenue)}
        </dd>
        <dd className="relative mt-auto pt-6">
          <Sparkline series={last30Days.series} />
          <p className="mt-2 text-[0.7rem] text-mist">Faturamento por dia, últimos 30 dias</p>
        </dd>
      </div>
    </div>
  );
}

export function FinanceOverview({ dashboard }: { dashboard: Dashboard }) {
  const { month } = dashboard;
  const loss = month.profit < 0;
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <RevenueHighlight dashboard={dashboard} />
      <StatCard label="Despesas do mês" value={formatBRL(month.expenses)} icon={ArrowDownRight} tone="pink" hint="Lançadas no Financeiro" />
      <StatCard
        label={loss ? "Prejuízo do mês" : "Lucro do mês"}
        value={formatBRL(Math.abs(month.profit))}
        icon={loss ? ArrowDownRight : ArrowUpRight}
        tone={loss ? "pink" : "emerald"}
        hint="Faturamento menos despesas"
      />
      <StatCard label="Ticket médio" value={formatBRL(month.averageTicket)} icon={Receipt} tone="electric" hint="Por pedido pago" />
      <StatCard
        label="A receber"
        value={formatBRL(month.receivable)}
        icon={month.receivableOrders > 0 ? HandCoins : Wallet}
        tone="amber"
        hint={`${month.receivableOrders} aguardando pagamento`}
      />
    </dl>
  );
}
