import { motion, useReducedMotion } from "framer-motion";
import { useMemo, type ReactNode } from "react";
import { loadDashboardSource } from "@/application/admin-use-cases";
import { listSupportTickets } from "@/application/support-use-cases";
import { buildChartViews, type ChartView } from "@/domain/chart-range";
import { buildDashboard, type Dashboard } from "@/domain/dashboard";
import { needsActionFrom } from "@/domain/support-ticket";
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
import { SupportDashboard } from "../dashboard/SupportDashboard";
import { BlockHeading } from "../dashboard/StatCard";
import { TikTokOverview } from "../dashboard/TikTokOverview";
import { useDashboardPeriod } from "../dashboard/useDashboardPeriod";
import { RevenueChart3D } from "../finance/RevenueChart3D";
import { useAdminQuery } from "../hooks";
import { useAdminView } from "../admin-view";
import { EnterPreviewButton } from "../preview/PreviewControls";

function Block({ id, title, link, children, className }: { id: string; title: string; link?: { to: string; label: string }; children: ReactNode; className?: string }) {
  return (
    <motion.section variants={fadeUp} aria-labelledby={id} className={className}>
      <BlockHeading id={id} title={title} link={link} />
      {children}
    </motion.section>
  );
}

interface DashboardContentProps {
  dashboard: Dashboard;
  period: DashboardPeriod;
  chartViews: ChartView[];
  /** Falso para a desenvolvedora: ela vê o dashboard como o Jota, mas sem atalhos para as telas da loja. */
  linked: boolean;
  supportPending: number;
}

function DashboardContent({ dashboard, period, chartViews, linked, supportPending }: DashboardContentProps) {
  const reduceMotion = useReducedMotion();
  const scope = scopeOf(period);
  const linkTo = (to: string, label: string) => (linked ? { to, label } : undefined);
  return (
    <motion.div variants={reduceMotion ? undefined : staggerContainer} initial="hidden" animate="show" className="space-y-8">
      <motion.div variants={fadeUp}>
        <PendingStrip dashboard={dashboard} scope={scope} linked={linked} supportPending={supportPending} />
      </motion.div>

      <Block id="bloco-financeiro" title={`Financeiro ${scope.of}`} link={linkTo("/admin/financeiro", "Abrir Financeiro")}>
        <FinanceOverview dashboard={dashboard} scope={scope} comparisonLabel={comparisonLabelOf(period)} />
      </Block>

      <motion.div variants={fadeUp}>
        <RevenueChart3D key={periodLabelOf(period)} views={chartViews} />
      </motion.div>

      <div className="grid gap-8 lg:grid-cols-5 lg:gap-4">
        <Block id="bloco-contas" title="Contas" link={linkTo("/admin/contas", "Ver contas")} className="lg:col-span-3">
          <AccountsOverview dashboard={dashboard} />
        </Block>
        <Block id="bloco-clientes" title="Clientes" link={linkTo("/admin/clientes", "Ver clientes")} className="lg:col-span-2">
          <CustomersOverview dashboard={dashboard} scope={scope} />
        </Block>
      </div>

      <Block id="bloco-tiktok" title="Métricas do TikTok" link={linkTo("/admin/contas", "Ver contas")}>
        <TikTokOverview dashboard={dashboard} scope={scope} />
      </Block>

      <Block id="bloco-pedidos" title="Últimos pedidos" link={linkTo("/admin/pedidos", "Ver todos")}>
        <RecentOrders orders={dashboard.recentOrders} />
      </Block>
    </motion.div>
  );
}

/** O dashboard da desenvolvedora é o do suporte; vendo ou testando como o Jota, ela vê o da loja. */
export default function DashboardPage() {
  const { viewRole } = useAdminView();
  if (viewRole === "developer") return <DeveloperDashboardPage />;
  return <StoreDashboardPage linked={viewRole === "admin"} showSupport={viewRole === "admin"} />;
}

function DeveloperDashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Como está o suporte: o que espera por você, o que está com o Jota e o ritmo das entregas." action={<EnterPreviewButton />} />
      <SupportDashboard />
    </div>
  );
}

/** Chamados aguardando o Jota: a mesma conta da bolinha do Suporte, também quando a Lay vê como ele. */
function useAdminSupportPending(enabled: boolean): number {
  const tickets = useAdminQuery((deps) => (enabled ? listSupportTickets(deps, "admin") : Promise.resolve([])), `dashboard-support-${enabled}`);
  const data = tickets.status === "success" ? tickets.data : null;
  return useMemo(() => (data ? data.filter((ticket) => needsActionFrom(ticket, "admin")).length : 0), [data]);
}

function StoreDashboardPage({ linked, showSupport }: { linked: boolean; showSupport: boolean }) {
  const source = useAdminQuery(loadDashboardSource, "admin-dashboard");
  const supportPending = useAdminSupportPending(showSupport);
  const [period, setPeriod] = useDashboardPeriod();
  const sourceData = source.status === "success" ? source.data : null;
  const dashboard = useMemo(() => (sourceData ? buildDashboard(sourceData, period) : null), [sourceData, period]);
  const chartViews = useMemo(() => (sourceData ? buildChartViews(sourceData, period) : []), [sourceData, period]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Como a loja está no período escolhido e o que está esperando por você."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <DashboardPeriodPicker value={period} onChange={setPeriod} />
          </div>
        }
      />
      {source.status === "loading" && <LoadingBlock />}
      {source.status === "error" && <ErrorState message={source.error.message} onRetry={source.reload} />}
      {dashboard && <DashboardContent dashboard={dashboard} period={period} chartViews={chartViews} linked={linked} supportPending={supportPending} />}
    </div>
  );
}
