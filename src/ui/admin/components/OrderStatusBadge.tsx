import { isReservationExpired, type Order, type OrderStatus } from "@/domain/order";
import { cn } from "@/ui/lib/cn";

const STATUS_VIEW: Record<OrderStatus, { label: string; className: string }> = {
  awaiting_payment: { label: "Aguardando pagamento", className: "border-pink/30 bg-pink/10 text-pink" },
  paid: { label: "Pago, falta entregar", className: "border-electric/40 bg-electric/10 text-electric-soft" },
  delivered: { label: "Entregue", className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" },
  canceled: { label: "Cancelado", className: "border-white/15 bg-white/[0.05] text-mist" },
};

export function OrderStatusBadge({ order }: { order: Order }) {
  const expired = isReservationExpired(order);
  const view = STATUS_VIEW[order.status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        expired ? STATUS_VIEW.canceled.className : view.className,
      )}
    >
      {expired ? "Reserva vencida" : view.label}
    </span>
  );
}
