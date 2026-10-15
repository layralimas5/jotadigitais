import type { Order } from "@/domain/order";
import { formatBRL } from "@/domain/money";
import { PlatformGlyph } from "@/ui/components/PlatformGlyph";
import { OrderStatusBadge } from "../components/OrderStatusBadge";
import { formatDate } from "../lib/dates";

export function RecentOrders({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return (
      <p className="rounded-3xl border border-dashed border-line-strong p-6 text-center text-sm text-mist">
        Quando alguém finalizar a compra no site, o pedido aparece aqui.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface/40">
      {orders.map((order) => (
        <li key={order.code} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.02] sm:gap-4 sm:px-5">
          <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/[0.04]">
            <PlatformGlyph platform={order.accountPlatform} className="size-4 text-fog" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-white">{order.customer.name}</span>
            <span className="block truncate text-xs text-mist">
              {order.code} · {order.accountHandle} · {formatDate(order.createdAt)}
            </span>
          </span>
          {/* No celular valor e status empilham à direita para o nome não ser cortado. */}
          <span className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-4">
            <span className="font-semibold text-white tabular-nums">{formatBRL(order.total)}</span>
            <OrderStatusBadge order={order} />
          </span>
        </li>
      ))}
    </ul>
  );
}
