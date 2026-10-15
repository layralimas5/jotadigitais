import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Mail, MessageCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { changeOrderStatus, listOrders } from "@/application/admin-use-cases";
import { formatBRL } from "@/domain/money";
import { ORDER_TRANSITIONS, type Order, type OrderStatus } from "@/domain/order";
import { PLATFORM_LABEL } from "@/domain/platform";
import { Button } from "@/ui/components/Button";
import { PlatformGlyph } from "@/ui/components/PlatformGlyph";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { cn } from "@/ui/lib/cn";
import { InlineError, LoadingBlock, PageHeader } from "../components/AdminUi";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { OrderStatusBadge } from "../components/OrderStatusBadge";
import { useAdminQuery, useMutation } from "../hooks";
import { firstNameOf, whatsappChatUrl } from "../lib/whatsapp";
import { useToast } from "../toast";

type Tab = "open" | "delivered" | "canceled" | "all";

const TABS: { id: Tab; label: string; matches: (order: Order) => boolean }[] = [
  { id: "open", label: "Em aberto", matches: (order) => order.status === "awaiting_payment" || order.status === "paid" },
  { id: "delivered", label: "Entregues", matches: (order) => order.status === "delivered" },
  { id: "canceled", label: "Cancelados", matches: (order) => order.status === "canceled" },
  { id: "all", label: "Todos", matches: () => true },
];

const ACTION_LABEL: Record<OrderStatus, string> = {
  awaiting_payment: "",
  paid: "Confirmar pagamento",
  delivered: "Marcar como entregue",
  canceled: "Cancelar pedido",
};

const PAYMENT_LABEL = { pix: "Pix", card: "Cartão" } as const;

const DONE_MESSAGE: Record<OrderStatus, string> = {
  awaiting_payment: "",
  paid: "Pagamento confirmado. A conta segue reservada.",
  delivered: "Pedido entregue. A conta saiu da vitrine.",
  canceled: "Pedido cancelado. A conta voltou para a vitrine.",
};

const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

function whatsappLink(order: Order): string | null {
  if (!order.customer.whatsapp) return null;
  return whatsappChatUrl(
    order.customer.whatsapp,
    `Olá, ${firstNameOf(order.customer.name)}! Aqui é da Jota Digitais, sobre o pedido ${order.code}.`,
  );
}

interface OrderCardProps {
  order: Order;
  busy: boolean;
  onAction: (order: Order, status: OrderStatus) => void;
}

function OrderCard({ order, busy, onAction }: OrderCardProps) {
  const whatsapp = whatsappLink(order);
  const actions = ORDER_TRANSITIONS[order.status];
  const reduceMotion = useReducedMotion();
  return (
    <motion.li
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, x: -24 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl border border-line bg-surface/60 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm font-semibold text-white">{order.code}</p>
          <p className="text-xs text-mist">{dateTime.format(new Date(order.createdAt))}</p>
        </div>
        <OrderStatusBadge order={order} />
      </div>

      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-mist">Cliente</dt>
          <dd className="mt-0.5 font-medium text-white">{order.customer.name}</dd>
          <dd className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            <a href={`mailto:${order.customer.email}`} className="inline-flex items-center gap-1 text-electric-soft hover:underline">
              <Mail aria-hidden className="size-3.5" /> {order.customer.email}
            </a>
            {whatsapp && (
              <a href={whatsapp} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-300 hover:underline">
                <MessageCircle aria-hidden className="size-3.5" /> WhatsApp
              </a>
            )}
          </dd>
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

      {actions.length > 0 && (
        <div className="mt-4 flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
          {actions.map((status) => (
            <Button
              key={status}
              variant={status === "canceled" ? "ghost" : "primary"}
              size="lg"
              disabled={busy}
              onClick={() => onAction(order, status)}
              className={status === "canceled" ? "text-[#ff7a7a] hover:text-[#ff9a9a]" : undefined}
            >
              {ACTION_LABEL[status]}
            </Button>
          ))}
        </div>
      )}
    </motion.li>
  );
}

export default function OrdersPage() {
  const orders = useAdminQuery(listOrders, "admin-orders");
  const toast = useToast();
  const change = useMutation(async (deps, order: Order, status: OrderStatus) => {
    await changeOrderStatus(deps, order, status);
    return true;
  });
  const [tab, setTab] = useState<Tab>("open");
  const [toCancel, setToCancel] = useState<Order | null>(null);

  const visible = useMemo(() => {
    if (orders.status !== "success") return [];
    const matcher = TABS.find((item) => item.id === tab)?.matches ?? (() => true);
    return orders.data.filter(matcher);
  }, [orders, tab]);

  const apply = async (order: Order, status: OrderStatus) => {
    const result = await change.run(order, status);
    setToCancel(null);
    if (!result) {
      toast.show("Não foi possível atualizar o pedido.", "error");
      return;
    }
    toast.show(DONE_MESSAGE[status]);
    orders.reload();
  };

  const onAction = (order: Order, status: OrderStatus) => {
    if (status === "canceled") setToCancel(order);
    else void apply(order, status);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pedidos"
        description="Pago reserva a conta sem prazo. Entregue marca como vendida. Cancelado devolve para a vitrine."
      />

      <div role="group" aria-label="Filtrar pedidos" className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {TABS.map((item) => {
          const count = orders.status === "success" ? orders.data.filter(item.matches).length : null;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={tab === item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-sm transition-colors",
                tab === item.id ? "border-electric bg-electric/15 text-white" : "border-line-strong text-mist hover:text-white",
              )}
            >
              {item.label}
              {count !== null && <span className="ml-1.5 text-xs text-mist tabular-nums">{count}</span>}
            </button>
          );
        })}
      </div>

      {change.error && <InlineError message={change.error.message} />}
      {orders.status === "loading" && <LoadingBlock />}
      {orders.status === "error" && <ErrorState message={orders.error.message} onRetry={orders.reload} />}
      {orders.status === "success" && visible.length === 0 && (
        <EmptyState
          title={tab === "open" ? "Nenhum pedido em aberto" : "Nada por aqui"}
          description="Quando alguém finaliza a compra no site, o pedido aparece aqui com os dados do cliente."
        />
      )}
      {visible.length > 0 && (
        <ul className="space-y-3">
          <AnimatePresence initial={false}>
            {visible.map((order) => (
              <OrderCard key={order.code} order={order} busy={change.pending} onAction={onAction} />
            ))}
          </AnimatePresence>
        </ul>
      )}

      <ConfirmDialog
        open={toCancel !== null}
        title="Cancelar este pedido?"
        description={
          <>
            O pedido <strong className="text-white">{toCancel?.code}</strong> é cancelado e a conta volta para a vitrine, a
            menos que outro pedido esteja segurando ela.
          </>
        }
        confirmLabel="Cancelar pedido"
        pending={change.pending}
        onConfirm={() => toCancel && void apply(toCancel, "canceled")}
        onClose={() => setToCancel(null)}
      />
    </div>
  );
}
