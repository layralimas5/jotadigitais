import { motion, useReducedMotion } from "framer-motion";
import { CalendarDays } from "lucide-react";
import type { ReactNode } from "react";
import { loadDashboard } from "@/application/admin-use-cases";
import type { Dashboard } from "@/domain/dashboard";
import { ErrorState } from "@/ui/components/StateViews";
import { fadeUp, staggerContainer } from "@/ui/lib/motion";
import { LoadingBlock, PageHeader } from "../components/AdminUi";
import { AccountsOverview } from "../dashboard/AccountsOverview";
import { CustomersOverview } from "../dashboard/CustomersOverview";
import { FinanceOverview } from "../dashboard/FinanceOverview";
import { PendingStrip } from "../dashboard/PendingStrip";
import { RecentOrders } from "../dashboard/RecentOrders";
import { BlockHeading } from "../dashboard/StatCard";
import { TikTokOverview } from "../dashboard/TikTokOverview";
import { RevenueChart3D } from "../finance/RevenueChart3D";
import { useAdminQuery } from "../hooks";

const monthFormat = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

/** "outubro de 2026" vira "Outubro de 2026". */
const currentMonthLabel = () => {
  const label = monthFormat.format(new Date());
  return label.charAt(0).toUpperCase() + label.slice(1);
};

function Block({ id, title, link, children, className }: { id: string; title: string; link?: { to: string; label: string }; children: ReactNode; className?: string }) {
  return (
    <motion.section variants={fadeUp} aria-labelledby={id} className={className}>
      <BlockHeading id={id} title={title} link={link} />
      {children}
    </motion.section>
  );
}

function DashboardContent({ dashboard }: { dashboard: Dashboard }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div variants={reduceMotion ? undefined : staggerContainer} initial="hidden" animate="show" className="space-y-8">
      <motion.div variants={fadeUp}>
        <PendingStrip dashboard={dashboard} />
      </motion.div>

      <Block id="bloco-financeiro" title="Financeiro do mês" link={{ to: "/admin/financeiro", label: "Abrir Financeiro" }}>
        <FinanceOverview dashboard={dashboard} />
      </Block>

      <motion.div variants={fadeUp}>
        <RevenueChart3D
          views={[
            { id: "months", label: "Últimos 6 meses", series: dashboard.last6Months.series },
            { id: "days", label: "Últimos 30 dias", series: dashboard.last30Days.series },
          ]}
        />
      </motion.div>

      <div className="grid gap-8 lg:grid-cols-5 lg:gap-4">
        <Block id="bloco-contas" title="Contas" link={{ to: "/admin/contas", label: "Ver contas" }} className="lg:col-span-3">
          <AccountsOverview dashboard={dashboard} />
        </Block>
        <Block id="bloco-clientes" title="Clientes" link={{ to: "/admin/clientes", label: "Ver clientes" }} className="lg:col-span-2">
          <CustomersOverview dashboard={dashboard} />
        </Block>
      </div>

      <Block id="bloco-tiktok" title="Métricas do TikTok" link={{ to: "/admin/contas", label: "Ver contas" }}>
        <TikTokOverview dashboard={dashboard} />
      </Block>

      <Block id="bloco-pedidos" title="Últimos pedidos" link={{ to: "/admin/pedidos", label: "Ver todos" }}>
        <RecentOrders orders={dashboard.recentOrders} />
      </Block>
    </motion.div>
  );
}

export default function DashboardPage() {
  const dashboard = useAdminQuery(loadDashboard, "admin-dashboard");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Como a loja está neste mês e o que está esperando por você."
        action={
          <p className="inline-flex items-center gap-2 self-start rounded-full border border-line-strong bg-surface px-3.5 py-1.5 text-xs text-fog sm:self-auto">
            <CalendarDays aria-hidden className="size-3.5 text-electric-soft" />
            {currentMonthLabel()}
          </p>
        }
      />
      {dashboard.status === "loading" && <LoadingBlock />}
      {dashboard.status === "error" && <ErrorState message={dashboard.error.message} onRetry={dashboard.reload} />}
      {dashboard.status === "success" && <DashboardContent dashboard={dashboard.data} />}
    </div>
  );
}
