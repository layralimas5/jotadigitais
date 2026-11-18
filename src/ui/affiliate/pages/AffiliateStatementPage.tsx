import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import {
  COMMISSION_STATES,
  COMMISSION_STATE_LABEL,
  COMMISSION_VIA_LABEL,
  commissionStateOf,
  summarizeCommissions,
  type AffiliateCommission,
  type CommissionState,
} from "@/domain/affiliate";
import { formatBRL } from "@/domain/money";
import { CommissionList } from "@/ui/components/affiliate/CommissionList";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { useAsync } from "@/ui/hooks/useAsync";
import { useDocumentMeta } from "@/ui/hooks/useDocumentMeta";
import { cn } from "@/ui/lib/cn";
import { csvMoney, downloadCsv } from "@/ui/lib/csv";
import { AffiliateSpinner } from "../AffiliateLayout";
import { StatTile } from "../components/AffiliateUi";
import { affiliatePortal, useAffiliateMe } from "../session";

const PERIODS = [
  { id: "30d", label: "Últimos 30 dias" },
  { id: "month", label: "Este mês" },
  { id: "last-month", label: "Mês passado" },
  { id: "all", label: "Tudo" },
  { id: "custom", label: "Escolher datas" },
] as const;
type PeriodId = (typeof PERIODS)[number]["id"];

interface Range {
  from: Date | null;
  to: Date | null;
}

const startOfDay = (iso: string) => new Date(`${iso}T00:00:00`);
const endOfDay = (iso: string) => new Date(`${iso}T23:59:59.999`);

function rangeOf(period: PeriodId, customFrom: string, customTo: string, now = new Date()): Range {
  switch (period) {
    case "30d":
      return { from: new Date(now.getTime() - 30 * 86_400_000), to: null };
    case "month":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: null };
    case "last-month":
      return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: new Date(now.getFullYear(), now.getMonth(), 1) };
    case "custom":
      return { from: customFrom ? startOfDay(customFrom) : null, to: customTo ? endOfDay(customTo) : null };
    case "all":
      return { from: null, to: null };
  }
}

const inRange = (commission: AffiliateCommission, range: Range) => {
  const created = new Date(commission.createdAt);
  return (!range.from || created >= range.from) && (!range.to || created < range.to);
};

type StateFilter = CommissionState | "all";

export default function AffiliateStatementPage() {
  useDocumentMeta("Extrato do afiliado");
  const me = useAffiliateMe();
  const commissions = useAsync(() => affiliatePortal.listCommissions(), `affiliate-statement:${me.id}`);
  const [period, setPeriod] = useState<PeriodId>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [state, setState] = useState<StateFilter>("all");

  const all = commissions.status === "success" ? commissions.data : null;
  const inPeriod = useMemo(() => (all ? all.filter((item) => inRange(item, rangeOf(period, customFrom, customTo))) : []), [all, period, customFrom, customTo]);
  const visible = state === "all" ? inPeriod : inPeriod.filter((item) => commissionStateOf(item) === state);
  const totals = summarizeCommissions(inPeriod);

  if (commissions.status === "loading") return <AffiliateSpinner />;
  if (commissions.status === "error") return <ErrorState message={commissions.error.message} onRetry={commissions.retry} />;

  const exportCsv = () =>
    downloadCsv(`extrato-afiliado-${me.code}.csv`, [
      ["Data", "Pedido", "Conta", "Origem", "Valor da venda", "Comissão", "Situação", "Libera em"],
      ...visible.map((item) => [
        item.createdAt.slice(0, 10),
        item.orderCode,
        item.accountHandle,
        COMMISSION_VIA_LABEL[item.via],
        csvMoney(item.base),
        csvMoney(item.amount),
        COMMISSION_STATE_LABEL[commissionStateOf(item)],
        item.releaseAt?.slice(0, 10) ?? "",
      ]),
    ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white sm:text-3xl">Extrato</h1>
          <p className="mt-1 text-sm text-fog">Cada venda paga pelo seu link ou cupom, com a comissão e quando ela libera.</p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={visible.length === 0}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-line-strong px-4 text-sm font-semibold text-white hover:bg-white/[0.06] disabled:opacity-50"
        >
          <Download aria-hidden className="size-4" /> Baixar planilha
        </button>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <label className="block lg:w-56">
          <span className="text-sm font-medium text-fog">Período</span>
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value as PeriodId)}
            className="mt-2 h-11 w-full cursor-pointer rounded-xl border border-line-strong bg-ink px-4 text-sm text-white [color-scheme:dark] focus:border-electric focus:outline-none"
          >
            {PERIODS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        {period === "custom" && (
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-medium text-fog">De</span>
              <input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-line-strong bg-ink px-3 text-sm text-white [color-scheme:dark]" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-fog">Até</span>
              <input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-line-strong bg-ink px-3 text-sm text-white [color-scheme:dark]" />
            </label>
          </div>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Vendas no período" value={String(totals.sales)} />
        <StatTile label="Pendente" value={formatBRL(totals.pending)} />
        <StatTile label="Liberado" value={formatBRL(totals.released)} highlight />
        <StatTile label="Cancelado" value={formatBRL(totals.canceled)} />
      </dl>

      <div role="group" aria-label="Situação" className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {(["all", ...COMMISSION_STATES] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={state === value}
            onClick={() => setState(value)}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-sm transition-colors",
              state === value ? "border-electric bg-electric/15 text-white" : "border-line-strong text-mist hover:text-white",
            )}
          >
            {value === "all" ? "Todas" : COMMISSION_STATE_LABEL[value]}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState title="Nada neste período" description="Troque o período ou a situação. As vendas aparecem aqui assim que o cliente paga." />
      ) : (
        <CommissionList commissions={visible} />
      )}
    </div>
  );
}
