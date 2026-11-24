import { useMemo } from "react";
import type { Account } from "@/domain/account";
import { stockCategoryOf } from "@/domain/stock";
import { STOCK_ALERT_CATEGORIES, STOCK_ALERT_CATEGORY_LABEL, type StockAlertCategory } from "@/domain/stock-alert";
import { cn } from "@/ui/lib/cn";
import { StockAlertButton } from "./StockAlertButton";

function availableByCategory(accounts: readonly Account[]): Record<StockAlertCategory, number> {
  const counts = Object.fromEntries(STOCK_ALERT_CATEGORIES.map((category) => [category, 0])) as Record<StockAlertCategory, number>;
  for (const account of accounts) {
    if (account.status !== "available") continue;
    const category = stockCategoryOf(account);
    if (category in counts) counts[category as StockAlertCategory] += 1;
  }
  return counts;
}

/**
 * "Estoque agora" na vitrine: quantas contas tem de cada tipo e quais estão esgotados, com o "Me avise" do tipo.
 * Assim o cliente sabe que falta uma categoria em vez de achar que a loja não vende.
 */
export function StockOverview({ accounts, alertPreset }: { accounts: readonly Account[]; alertPreset: readonly StockAlertCategory[] }) {
  const counts = useMemo(() => availableByCategory(accounts), [accounts]);
  const soldOut = STOCK_ALERT_CATEGORIES.filter((category) => counts[category] === 0);
  const [onlySoldOut] = soldOut.length === 1 ? soldOut : [];

  return (
    <section aria-labelledby="estoque-title" className="mt-6">
      <h2 id="estoque-title" className="text-xs font-semibold tracking-wide text-mist uppercase">
        Estoque agora
      </h2>
      <ul className="-mx-4 mt-3 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {STOCK_ALERT_CATEGORIES.map((category) => {
          const available = counts[category];
          return (
            <li
              key={category}
              className={cn(
                "flex shrink-0 snap-start items-center gap-2 rounded-full border py-1.5 pr-3 pl-2.5 text-sm",
                available > 0 ? "border-line-strong bg-surface/70 text-fog" : "border-amber-300/30 bg-amber-300/[0.06] text-amber-100",
              )}
            >
              <span aria-hidden className={cn("size-2 rounded-full", available > 0 ? "bg-emerald-400" : "bg-amber-300")} />
              <span className="font-medium text-white">{STOCK_ALERT_CATEGORY_LABEL[category]}</span>
              <span className="tabular-nums">{available > 0 ? `${available} ${available === 1 ? "disponível" : "disponíveis"}` : "Esgotado"}</span>
            </li>
          );
        })}
      </ul>
      {soldOut.length > 0 ? (
        <StockAlertButton
          initial={soldOut}
          label={onlySoldOut ? `Me avise quando chegar ${STOCK_ALERT_CATEGORY_LABEL[onlySoldOut]}` : "Me avise quando chegar o que está esgotado"}
          className="mt-3"
        />
      ) : (
        <StockAlertButton initial={alertPreset} className="mt-3" />
      )}
    </section>
  );
}
