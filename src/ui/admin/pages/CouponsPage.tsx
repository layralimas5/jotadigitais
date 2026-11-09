import { Plus, TicketPercent } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listCouponSummaries, type CouponSummary } from "@/application/admin-use-cases";
import { COUPON_STATUS_LABEL, couponStatusOf, couponValueLabel, type Coupon, type CouponStatus } from "@/domain/coupon";
import { formatBRL } from "@/domain/money";
import { ButtonLink } from "@/ui/components/Button";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { cn } from "@/ui/lib/cn";
import { Fab, LoadingBlock, PageHeader } from "../components/AdminUi";
import { Kpi } from "../components/Kpi";
import { SearchInput } from "../components/SearchInput";
import { useAdminQuery } from "../hooks";

const NEW_PATH = "/admin/cupons/novo";

const STATUS_TONE: Record<CouponStatus, string> = {
  active: "border-emerald-400/30 bg-emerald-400/[0.08] text-emerald-200",
  scheduled: "border-electric/30 bg-electric/[0.08] text-electric-soft",
  inactive: "border-white/15 bg-white/[0.05] text-mist",
  expired: "border-white/15 bg-white/[0.05] text-mist",
  exhausted: "border-amber-300/30 bg-amber-300/[0.08] text-amber-200",
};

const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

/** O fim é exclusivo (meia-noite do dia seguinte): mostra o último dia que vale. */
const lastValidDay = (endsAt: string) => shortDate.format(new Date(new Date(endsAt).getTime() - 1));

function periodLabel(coupon: Coupon): string {
  if (coupon.startsAt && coupon.endsAt) return `${shortDate.format(new Date(coupon.startsAt))} a ${lastValidDay(coupon.endsAt)}`;
  if (coupon.endsAt) return `Até ${lastValidDay(coupon.endsAt)}`;
  if (coupon.startsAt) return `A partir de ${shortDate.format(new Date(coupon.startsAt))}`;
  return "Sem prazo";
}

const usesLabel = (coupon: Coupon) =>
  coupon.maxUses === null ? `${coupon.uses} ${coupon.uses === 1 ? "uso" : "usos"}` : `${coupon.uses} de ${coupon.maxUses} usos`;

function StatusBadge({ status }: { status: CouponStatus }) {
  return (
    <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[0.68rem] font-semibold", STATUS_TONE[status])}>
      {COUPON_STATUS_LABEL[status]}
    </span>
  );
}

function CouponCard({ summary }: { summary: CouponSummary }) {
  const { coupon } = summary;
  const status = couponStatusOf(coupon);
  return (
    <li className="relative rounded-2xl border border-line bg-surface/60 p-4 transition-colors hover:bg-surface">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to={`/admin/cupons/${coupon.id}`}
            className="block truncate font-mono text-base font-semibold tracking-wide text-white after:absolute after:inset-0 hover:text-electric-soft focus-visible:outline-none"
          >
            {coupon.code}
          </Link>
          <p className="mt-0.5 text-sm text-fog">
            {couponValueLabel(coupon, formatBRL)} de desconto
          </p>
        </div>
        <StatusBadge status={status} />
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-xs">
        <div className="min-w-0">
          <dt className="text-mist">Validade</dt>
          <dd className="mt-0.5 text-fog">{periodLabel(coupon)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-mist">Usos</dt>
          <dd className="mt-0.5 text-fog tabular-nums">{usesLabel(coupon)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-mist">Desconto dado</dt>
          <dd className="mt-0.5 font-semibold text-white tabular-nums">{formatBRL(summary.discountGiven)}</dd>
        </div>
      </dl>
    </li>
  );
}

const matches = (summary: CouponSummary, query: string) => summary.coupon.code.includes(query.trim().toUpperCase());

export default function CouponsPage() {
  const summaries = useAdminQuery(listCouponSummaries, "admin-coupons");
  const [query, setQuery] = useState("");
  const data = summaries.status === "success" ? summaries.data : null;
  const visible = useMemo(() => (data ? data.filter((summary) => matches(summary, query)) : []), [data, query]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cupons"
        description="Códigos de desconto para o checkout do site. O cliente digita o cupom na compra e o desconto entra no Pix e no cartão."
        action={
          <ButtonLink to={NEW_PATH} className="max-md:hidden">
            <Plus aria-hidden className="size-4" /> Novo cupom
          </ButtonLink>
        }
      />

      {summaries.status === "loading" && <LoadingBlock />}
      {summaries.status === "error" && <ErrorState message={summaries.error.message} onRetry={summaries.reload} />}
      {data && data.length === 0 && (
        <EmptyState
          title="Nenhum cupom ainda"
          description="Crie um código, escolha o desconto em % ou em reais e, se quiser, a validade e o limite de usos."
          action={
            <ButtonLink to={NEW_PATH}>
              <TicketPercent aria-hidden className="size-4" /> Criar cupom
            </ButtonLink>
          }
        />
      )}
      {data && data.length > 0 && (
        <>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Kpi label="Cupons valendo" value={String(data.filter((summary) => couponStatusOf(summary.coupon) === "active").length)} />
            <Kpi label="Usos" value={String(data.reduce((sum, summary) => sum + summary.coupon.uses, 0))} hint="Pedidos com cupom, sem os cancelados" />
            <Kpi label="Desconto dado" value={formatBRL(data.reduce((sum, summary) => sum + summary.discountGiven, 0))} />
          </dl>
          <SearchInput label="Buscar cupom" placeholder="Buscar pelo código" value={query} onChange={setQuery} />
          {visible.length === 0 ? (
            <EmptyState title="Nenhum cupom encontrado" description="Confira o código digitado." />
          ) : (
            <ul className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
              {visible.map((summary) => (
                <CouponCard key={summary.coupon.id} summary={summary} />
              ))}
            </ul>
          )}
        </>
      )}
      <Fab to={NEW_PATH} label="Novo cupom" />
    </div>
  );
}
