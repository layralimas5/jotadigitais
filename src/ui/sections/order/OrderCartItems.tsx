import { formatBRL } from "@/domain/money";
import type { OrderCartItem } from "@/domain/order";
import { PlatformTag } from "@/ui/components/account/AccountBadges";

/** Contas que vieram no carrinho, na página do pedido principal. Pedido de uma conta só não mostra nada. */
export function OrderCartItems({ items }: { items: readonly OrderCartItem[] }) {
  if (items.length < 2) return null;
  return (
    <section aria-labelledby="contas-do-pedido" className="mx-auto mt-6 max-w-md text-left">
      <h2 id="contas-do-pedido" className="text-xs font-semibold tracking-wide text-mist uppercase">
        {items.length} contas neste pedido
      </h2>
      <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface/60">
        {items.map((item) => (
          <li key={item.code} className="flex items-center gap-3 p-4">
            <PlatformTag platform={item.accountPlatform} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{item.accountHandle}</p>
              <p className="truncate text-xs text-mist">{item.accountName}</p>
            </div>
            <p className="shrink-0 text-sm font-semibold text-white tabular-nums">{formatBRL(item.total)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
