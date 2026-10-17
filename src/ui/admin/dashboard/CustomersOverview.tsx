import { Repeat, ShoppingBag, UserPlus, Users } from "lucide-react";
import type { Dashboard } from "@/domain/dashboard";
import type { PeriodScope } from "@/domain/dashboard-period";
import { SegmentBar, ToneIcon } from "./StatCard";

const rowsOf = (scope: PeriodScope) => [
  { key: "newInPeriod", label: `Novos ${scope.in}`, icon: UserPlus, tone: "electric" },
  { key: "returning", label: "Compraram 2 vezes ou mais", icon: Repeat, tone: "emerald" },
  { key: "withOpenOrders", label: "Com pedido em aberto", icon: ShoppingBag, tone: "amber" },
] as const;

export function CustomersOverview({ dashboard, scope }: { dashboard: Dashboard; scope: PeriodScope }) {
  const { customers } = dashboard;
  return (
    <div className="h-full rounded-3xl border border-line bg-surface/60 p-5 sm:p-6">
      <dl>
        <div className="flex items-center gap-3">
          <ToneIcon icon={Users} tone="pink" />
          <div>
            <dt className="text-xs text-mist">Clientes</dt>
            <dd className="font-display text-3xl leading-tight font-semibold text-white tabular-nums">{customers.total}</dd>
          </div>
        </div>
        <div className="mt-4">
          <dt className="flex justify-between text-xs text-mist">
            <span>Já compraram</span>
            <span className="text-fog tabular-nums">
              {customers.buyers} de {customers.total}
            </span>
          </dt>
          <dd>
            <SegmentBar
              className="mt-2"
              segments={[
                { label: "Compraram", value: customers.buyers, tone: "pink" },
                { label: "Ainda não", value: customers.total - customers.buyers, tone: "electric" },
              ]}
            />
          </dd>
        </div>
        <div className="mt-5 divide-y divide-line">
          {rowsOf(scope).map((row) => (
            <div key={row.key} className="flex items-center gap-3 py-2.5">
              <ToneIcon icon={row.icon} tone={row.tone} className="size-8 rounded-lg" />
              <dt className="flex-1 text-sm text-fog">{row.label}</dt>
              <dd className="font-display text-lg font-semibold text-white tabular-nums">{customers[row.key]}</dd>
            </div>
          ))}
        </div>
      </dl>
    </div>
  );
}
