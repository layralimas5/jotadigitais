import { isReservationExpired, type Order, type OrderStatus } from "@/domain/order";
import { cn } from "@/ui/lib/cn";

const TONE = {
  reserved: "border-amber-300/40 bg-amber-300/10 text-amber-200",
  sold: "border-emerald-400/35 bg-emerald-400/10 text-emerald-300",
  canceled: "border-red-400/40 bg-red-500/10 text-red-300",
} as const;

const STATUS_VIEW: Record<OrderStatus, { label: string; className: string }> = {
  awaiting_payment: { label: "Aguardando pagamento", className: TONE.reserved },
  paid: { label: "Pago, falta entregar", className: TONE.sold },
  delivered: { label: "Entregue", className: TONE.sold },
  canceled: { label: "Cancelado", className: TONE.canceled },
};

export function OrderStatusBadge({ order }: { order: Order }) {
  const expired = isReservationExpired(order);
  const view = STATUS_VIEW[order.status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        expired ? TONE.reserved : view.className,
      )}
    >
      {expired ? "Reserva vencida" : view.label}
    </span>
  );
}
