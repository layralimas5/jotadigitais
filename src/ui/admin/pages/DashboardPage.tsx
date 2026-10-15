import { ArrowRight, CalendarClock, CircleCheck, Handshake, PackageCheck, Wallet, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { loadDashboard } from "@/application/admin-use-cases";
import type { Dashboard } from "@/domain/dashboard";
import { formatBRL } from "@/domain/money";
import { PLATFORM_LABEL } from "@/domain/platform";
import { PlatformGlyph } from "@/ui/components/PlatformGlyph";
import { ErrorState } from "@/ui/components/StateViews";
import { LoadingBlock, PageHeader } from "../components/AdminUi";
import { Kpi } from "../components/Kpi";
import { OrderStatusBadge } from "../components/OrderStatusBadge";
import { RevenueChart } from "../finance/RevenueChart";
import { useAdminQuery } from "../hooks";
import { formatDate } from "../lib/dates";

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function MonthKpis({ dashboard }: { dashboard: Dashboard }) {
  const { month } = dashboard;
  const profitTone = month.profit > 0 ? "positive" : month.profit < 0 ? "negative" : undefined;
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Kpi label="Faturamento do mês" value={formatBRL(month.revenue)} hint={plural(month.paidOrders, "pedido pago", "pedidos pagos")} />
      <Kpi label={month.profit < 0 ? "Prejuízo do mês" : "Lucro do mês"} value={formatBRL(Math.abs(month.profit))} hint="Faturamento menos despesas" tone={profitTone} />
      <Kpi label="Vendas finalizadas" value={String(dashboard.finalizedThisMonth)} hint="Entregues este mês" />
      <Kpi label="A receber" value={formatBRL(month.receivable)} hint={`${month.receivableOrders} aguardando pagamento`} />
    </dl>
  );
}

interface Pending {
  to: string;
  icon: LucideIcon;
  /** Texto depois do número, já no singular ou no plural. */
  label: string;
  count: number;
}

function pendingOf(dashboard: Dashboard): Pending[] {
  const { awaitingPayment, awaitingDelivery, followUpsDue } = dashboard;
  return [
    {
      to: "/admin/pedidos",
      icon: Wallet,
      label: awaitingPayment === 1 ? "pedido aguardando pagamento" : "pedidos aguardando pagamento",
      count: awaitingPayment,
    },
    {
      to: "/admin/pedidos",
      icon: PackageCheck,
      label: awaitingDelivery === 1 ? "pedido pago para entregar" : "pedidos pagos para entregar",
      count: awaitingDelivery,
    },
    {
      to: "/admin/crm",
      icon: CalendarClock,
      label: followUpsDue === 1 ? "retorno do CRM para hoje ou atrasado" : "retornos do CRM para hoje ou atrasados",
      count: followUpsDue,
    },
  ].filter((item) => item.count > 0);
}

function PendingCard({ dashboard }: { dashboard: Dashboard }) {
  const pending = pendingOf(dashboard);
  return (
    <section aria-labelledby="pendencias-title" className="rounded-3xl border border-line bg-surface/60 p-5 sm:p-6">
      <h2 id="pendencias-title" className="font-display text-base font-semibold text-white">
        Precisa de você
      </h2>
      {pending.length === 0 ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-fog">
          <CircleCheck aria-hidden className="size-4 text-emerald-300" /> Nada pendente agora.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {pending.map(({ to, icon: Icon, label, count }) => (
            <li key={label}>
              <Link to={to} className="group flex items-center gap-3 py-3 text-sm">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-electric/10 text-electric">
                  <Icon aria-hidden className="size-4" />
                </span>
                <span className="flex-1 text-fog group-hover:text-white">
                  <strong className="font-semibold text-white tabular-nums">{count}</strong> {label}
                </span>
                <ArrowRight aria-hidden className="size-4 text-mist transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {dashboard.commissionThisMonth > 0 && (
        <Link to="/admin/parceiros" className="mt-3 flex items-center gap-3 border-t border-line pt-4 text-sm text-fog hover:text-white">
          <Handshake aria-hidden className="size-4 text-pink" />
          <span className="flex-1">
            Comissão de parceiros no mês: <strong className="text-white tabular-nums">{formatBRL(dashboard.commissionThisMonth)}</strong>
          </span>
        </Link>
      )}
    </section>
  );
}

function StockCard({ dashboard }: { dashboard: Dashboard }) {
  return (
    <section aria-labelledby="estoque-title" className="rounded-3xl border border-line bg-surface/60 p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="estoque-title" className="font-display text-base font-semibold text-white">
          Estoque na vitrine
        </h2>
        <Link to="/admin/contas" className="text-xs text-electric-soft underline-offset-4 hover:underline">
          Ver contas
        </Link>
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-2.5">
        {dashboard.stock.map((item) => (
          <li key={item.platform} className="rounded-2xl border border-line bg-ink/60 p-3">
            <p className="flex items-center gap-1.5 text-xs text-mist">
              <PlatformGlyph platform={item.platform} className="size-3.5" /> {PLATFORM_LABEL[item.platform]}
            </p>
            <p className="mt-1 font-display text-xl font-semibold text-white tabular-nums">{item.available}</p>
            <p className="text-xs text-mist">{item.reserved > 0 ? `disponíveis, ${plural(item.reserved, "reservada", "reservadas")}` : "disponíveis"}</p>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-fog">
        Valor do estoque disponível: <strong className="text-white tabular-nums">{formatBRL(dashboard.stockValue)}</strong>
      </p>
    </section>
  );
}

function RecentOrders({ dashboard }: { dashboard: Dashboard }) {
  return (
    <section aria-labelledby="recentes-title">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="recentes-title" className="font-display text-lg font-semibold text-white">
          Últimos pedidos
        </h2>
        <Link to="/admin/pedidos" className="text-xs text-electric-soft underline-offset-4 hover:underline">
          Ver todos
        </Link>
      </div>
      {dashboard.recentOrders.length === 0 ? (
        <p className="mt-3 rounded-3xl border border-dashed border-line-strong p-6 text-center text-sm text-mist">
          Quando alguém finalizar a compra no site, o pedido aparece aqui.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface/40">
          {dashboard.recentOrders.map((order) => (
            <li key={order.code} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
              <PlatformGlyph platform={order.accountPlatform} className="size-4 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-white">{order.customer.name}</span>
                <span className="block truncate text-xs text-mist">
                  {order.code} · {order.accountHandle} · {formatDate(order.createdAt)}
                </span>
              </span>
              <span className="font-semibold text-white tabular-nums">{formatBRL(order.total)}</span>
              <OrderStatusBadge order={order} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function DashboardPage() {
  const dashboard = useAdminQuery(loadDashboard, "admin-dashboard");

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Como a loja está neste mês e o que está esperando por você." />
      {dashboard.status === "loading" && <LoadingBlock />}
      {dashboard.status === "error" && <ErrorState message={dashboard.error.message} onRetry={dashboard.reload} />}
      {dashboard.status === "success" && (
        <>
          <MonthKpis dashboard={dashboard.data} />
          <div className="grid gap-4 lg:grid-cols-2">
            <PendingCard dashboard={dashboard.data} />
            <StockCard dashboard={dashboard.data} />
          </div>
          <section aria-labelledby="grafico-title" className="space-y-3">
            <h2 id="grafico-title" className="font-display text-lg font-semibold text-white">
              Últimos 30 dias
            </h2>
            <RevenueChart series={dashboard.data.last30Days.series} />
          </section>
          <RecentOrders dashboard={dashboard.data} />
        </>
      )}
    </div>
  );
}
