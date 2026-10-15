import { MessageCircle, ShieldCheck, ShieldOff } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadFinalizedSales } from "@/application/admin-use-cases";
import { customerKeyOf } from "@/domain/customer";
import { rangeOf, toLocalIsoDate, type DateRange, type PeriodPreset } from "@/domain/finance";
import type { MessageTemplates } from "@/domain/message-template";
import { formatBRL } from "@/domain/money";
import type { Order } from "@/domain/order";
import { PLATFORM_LABEL } from "@/domain/platform";
import { deliveredAtOf, warrantyOf } from "@/domain/sale";
import { PlatformGlyph } from "@/ui/components/PlatformGlyph";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { cn } from "@/ui/lib/cn";
import { LoadingBlock, PageHeader } from "../components/AdminUi";
import { Kpi } from "../components/Kpi";
import { PeriodFilter } from "../components/PeriodFilter";
import { SearchInput } from "../components/SearchInput";
import { useAdminQuery, useMessageTemplates } from "../hooks";
import { formatDate } from "../lib/dates";
import { orderMessage } from "../lib/messages";
import { whatsappChatUrl } from "../lib/whatsapp";

const PAYMENT_LABEL = { pix: "Pix", card: "Cartão" } as const;

const deliveredDayOf = (order: Order) => toLocalIsoDate(new Date(deliveredAtOf(order)));

const inRange = (order: Order, range: DateRange) => {
  const day = deliveredDayOf(order);
  return (range.from === null || day >= range.from) && day <= range.to;
};

function matches(order: Order, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [order.code, order.customer.name, order.customer.email, order.accountHandle, order.accountName].some((field) =>
    field.toLowerCase().includes(needle),
  );
}

function WarrantyBadge({ order, guaranteeDays }: { order: Order; guaranteeDays: number }) {
  const warranty = warrantyOf(order, guaranteeDays);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        warranty.active ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-white/15 bg-white/[0.05] text-mist",
      )}
    >
      {warranty.active ? <ShieldCheck aria-hidden className="size-3.5" /> : <ShieldOff aria-hidden className="size-3.5" />}
      {warranty.active
        ? `Em garantia, ${warranty.daysLeft === 1 ? "falta 1 dia" : `faltam ${warranty.daysLeft} dias`}`
        : `Garantia encerrada em ${formatDate(warranty.endsAt.toISOString())}`}
    </span>
  );
}

function SaleCard({ order, guaranteeDays, templates }: { order: Order; guaranteeDays: number; templates: MessageTemplates }) {
  const customerPath = `/admin/clientes/${encodeURIComponent(customerKeyOf(order.customer.email))}`;
  return (
    <li className="rounded-2xl border border-line bg-surface/60 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm font-semibold text-white">{order.code}</p>
          <p className="text-xs text-mist">Entregue em {formatDate(deliveredAtOf(order))}</p>
        </div>
        <WarrantyBadge order={order} guaranteeDays={guaranteeDays} />
      </div>

      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-mist">Cliente</dt>
          <dd className="mt-0.5 font-medium text-white">
            <Link to={customerPath} className="hover:text-electric-soft hover:underline">
              {order.customer.name}
            </Link>
          </dd>
          {order.customer.whatsapp && (
            <dd className="mt-1 text-xs">
              <a
                href={whatsappChatUrl(order.customer.whatsapp, orderMessage(templates, order))}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-emerald-300 hover:underline"
              >
                <MessageCircle aria-hidden className="size-3.5" /> WhatsApp
              </a>
            </dd>
          )}
        </div>
        <div>
          <dt className="text-xs text-mist">Conta</dt>
          <dd className="mt-0.5 flex items-center gap-1.5 font-medium text-white">
            <PlatformGlyph platform={order.accountPlatform} className="size-3.5" />
            {order.accountId ? (
              <Link to={`/admin/contas/${order.accountId}`} className="hover:text-electric-soft hover:underline">
                {order.accountHandle}
              </Link>
            ) : (
              <span>{order.accountHandle}</span>
            )}
          </dd>
          <dd className="text-xs text-mist">
            {order.accountName} · {PLATFORM_LABEL[order.accountPlatform]}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-mist">Valor</dt>
          <dd className="mt-0.5 font-display text-lg font-bold text-white tabular-nums">{formatBRL(order.total)}</dd>
          <dd className="text-xs text-mist">{PAYMENT_LABEL[order.paymentMethod]}</dd>
        </div>
      </dl>
    </li>
  );
}

export default function FinalizedPage() {
  const sales = useAdminQuery(loadFinalizedSales, "admin-finalized");
  const templates = useMessageTemplates();
  const [period, setPeriod] = useState<PeriodPreset>("all");
  const [query, setQuery] = useState("");
  const range = useMemo(() => rangeOf(period), [period]);

  const data = sales.status === "success" ? sales.data : null;
  const inPeriod = useMemo(() => (data ? data.sales.filter((order) => inRange(order, range)) : []), [data, range]);
  const visible = useMemo(() => inPeriod.filter((order) => matches(order, query)), [inPeriod, query]);
  const underWarranty = data ? inPeriod.filter((order) => warrantyOf(order, data.guaranteeDays).active).length : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finalizados"
        description="Pedidos entregues. A garantia conta a partir da entrega, com o prazo definido em Site."
      />
      <PeriodFilter value={period} onChange={setPeriod} />

      {sales.status === "loading" && <LoadingBlock />}
      {sales.status === "error" && <ErrorState message={sales.error.message} onRetry={sales.reload} />}
      {data && (
        <>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3 [&>div:last-child]:col-span-2 lg:[&>div:last-child]:col-span-1">
            <Kpi label="Vendas finalizadas" value={String(inPeriod.length)} />
            <Kpi label="Faturado" value={formatBRL(inPeriod.reduce((sum, order) => sum + order.total, 0))} />
            <Kpi label="Em garantia agora" value={String(underWarranty)} hint={`Garantia de ${data.guaranteeDays} dias`} />
          </dl>

          <SearchInput label="Buscar venda" placeholder="Buscar por pedido, cliente ou conta" value={query} onChange={setQuery} />

          {data.sales.length === 0 && (
            <EmptyState
              title="Nenhuma venda finalizada ainda"
              description="Quando você marcar um pedido como entregue em Pedidos, ele aparece aqui."
            />
          )}
          {data.sales.length > 0 && visible.length === 0 && (
            <EmptyState title="Nada encontrado" description="Mude o período ou confira o que foi digitado na busca." />
          )}
          {visible.length > 0 && (
            <ul className="space-y-3">
              {visible.map((order) => (
                <SaleCard key={order.code} order={order} guaranteeDays={data.guaranteeDays} templates={templates} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
