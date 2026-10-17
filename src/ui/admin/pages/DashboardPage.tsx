import { motion, useReducedMotion } from "framer-motion";
import { useMemo, type ReactNode } from "react";
import { loadDashboardSource } from "@/application/admin-use-cases";
import { buildChartViews, type ChartView } from "@/domain/chart-range";
import { buildDashboard, type Dashboard } from "@/domain/dashboard";
import { comparisonLabelOf, periodLabelOf, scopeOf, type DashboardPeriod } from "@/domain/dashboard-period";
import { ErrorState } from "@/ui/components/StateViews";
import { fadeUp, staggerContainer } from "@/ui/lib/motion";
import { LoadingBlock, PageHeader } from "../components/AdminUi";
import { AccountsOverview } from "../dashboard/AccountsOverview";
import { CustomersOverview } from "../dashboard/CustomersOverview";
import { DashboardPeriodPicker } from "../dashboard/DashboardPeriodPicker";
import { FinanceOverview } from "../dashboard/FinanceOverview";
import { PendingStrip } from "../dashboard/PendingStrip";
import { RecentOrders } from "../dashboard/RecentOrders";
import { BlockHeading } from "../dashboard/StatCard";
import { TikTokOverview } from "../dashboard/TikTokOverview";
import { useDashboardPeriod } from "../dashboard/useDashboardPeriod";
import { RevenueChart3D } from "../finance/RevenueChart3D";
import { useAdminQuery } from "../hooks";

function Block({ id, title, link, children, className }: { id: string; title: string; link?: { to: string; label: string }; children: ReactNode; className?: string }) {
  return (
    <motion.section variants={fadeUp} aria-labelledby={id} className={className}>
      <BlockHeading id={id} title={title} link={link} />
      {children}
    </motion.section>
  );
}

function DashboardContent({ dashboard, period, chartViews }: { dashboard: Dashboard; period: DashboardPeriod; chartViews: ChartView[] }) {
  const reduceMotion = useReducedMotion();
  const scope = scopeOf(period);
  return (
    <motion.div variants={reduceMotion ? undefined : staggerContainer} initial="hidden" animate="show" className="space-y-8">
      <motion.div variants={fadeUp}>
        <PendingStrip dashboard={dashboard} scope={scope} />
      </motion.div>

      <Block id="bloco-financeiro" title={`Financeiro ${scope.of}`} link={{ to: "/admin/financeiro", label: "Abrir Financeiro" }}>
        <FinanceOverview dashboard={dashboard} scope={scope} comparisonLabel={comparisonLabelOf(period)} />
      </Block>

      <motion.div variants={fadeUp}>
        <RevenueChart3D key={periodLabelOf(period)} views={chartViews} />
      </motion.div>

      <div className="grid gap-8 lg:grid-cols-5 lg:gap-4">
        <Block id="bloco-contas" title="Contas" link={{ to: "/admin/contas", label: "Ver contas" }} className="lg:col-span-3">
          <AccountsOverview dashboard={dashboard} />
        </Block>
        <Block id="bloco-clientes" title="Clientes" link={{ to: "/admin/clientes", label: "Ver clientes" }} className="lg:col-span-2">
          <CustomersOverview dashboard={dashboard} scope={scope} />
        </Block>
      </div>

      <Block id="bloco-tiktok" title="Métricas do TikTok" link={{ to: "/admin/contas", label: "Ver contas" }}>
        <TikTokOverview dashboard={dashboard} scope={scope} />
      </Block>

      <Block id="bloco-pedidos" title="Últimos pedidos" link={{ to: "/admin/pedidos", label: "Ver todos" }}>
        <RecentOrders orders={dashboard.recentOrders} />
      </Block>
    </motion.div>
  );
}

export default function DashboardPage() {
  const source = useAdminQuery(loadDashboardSource, "admin-dashboard");
  const [period, setPeriod] = useDashboardPeriod();
  const sourceData = source.status === "success" ? source.data : null;
  const dashboard = useMemo(() => (sourceData ? buildDashboard(sourceData, period) : null), [sourceData, period]);
  const chartViews = useMemo(() => (sourceData ? buildChartViews(sourceData, period) : []), [sourceData, period]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Como a loja está no período escolhido e o que está esperando por você."
        action={<DashboardPeriodPicker value={period} onChange={setPeriod} />}
      />
      {source.status === "loading" && <LoadingBlock />}
      {source.status === "error" && <ErrorState message={source.error.message} onRetry={source.reload} />}
      {dashboard && <DashboardContent dashboard={dashboard} period={period} chartViews={chartViews} />}
    </div>
  );
}
