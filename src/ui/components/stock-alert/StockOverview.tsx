import { useMemo } from "react";
import type { Account } from "@/domain/account";
import { stockCategoryOf } from "@/domain/stock";
import { STOCK_ALERT_CATEGORIES, STOCK_ALERT_CATEGORY_LABEL, type StockAlertCategory } from "@/domain/stock-alert";
import { useSiteContent } from "@/ui/hooks/useSiteContent";
import { cn } from "@/ui/lib/cn";
import { editable } from "@/ui/lib/site-preview";
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
  const { stockTitle, soldOutButton, soldOutOneButton } = useSiteContent().catalogPage;

  return (
    <section aria-labelledby="estoque-title" className="mt-6">
      <h2 id="estoque-title" {...editable("catalogPage.stockTitle")} className="text-xs font-semibold tracking-wide text-mist uppercase">
        {stockTitle}
      </h2>
      <ul className="-mx-4 mt-3 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {STOCK_ALERT_CATEGORIES.map((category) => {
          const available = counts[category];
          return (
            <li
              key={category}
              className={cn(
                "flex shrink-0 snap-start items-center gap-2 rounded-full border py-1.5 pr-3 pl-2.5 text-sm",
                available > 0 ? "border-electric/35 bg-electric/[0.08] text-fog" : "border-line bg-white/[0.03] text-mist",
              )}
            >
              <span aria-hidden className={cn("size-2 rounded-full", available > 0 ? "bg-electric" : "bg-white/25")} />
              <span className={cn("font-medium", available > 0 ? "text-white" : "text-fog")}>{STOCK_ALERT_CATEGORY_LABEL[category]}</span>
              <span className="tabular-nums">{available > 0 ? `${available} ${available === 1 ? "disponível" : "disponíveis"}` : "Esgotado"}</span>
            </li>
          );
        })}
      </ul>
      {soldOut.length > 0 ? (
        <StockAlertButton
          initial={soldOut}
          label={onlySoldOut ? soldOutOneButton.replaceAll("{tipo}", STOCK_ALERT_CATEGORY_LABEL[onlySoldOut]) : soldOutButton}
          editPath={onlySoldOut ? "catalogPage.soldOutOneButton" : "catalogPage.soldOutButton"}
          className="mt-3"
        />
      ) : (
        <StockAlertButton initial={alertPreset} className="mt-3" />
      )}
    </section>
  );
}

/**
 * Enquanto o estoque carrega: o mesmo quadro, com os tipos e a contagem pulsando. Sem isso a vitrine mostrava o botão
 * "Me avise" sozinho e trocava de layout segundos depois (chamado "Delay também quando abre").
 */
export function StockOverviewLoading() {
  const { stockTitle } = useSiteContent().catalogPage;
  return (
    <section aria-labelledby="estoque-title" aria-busy className="mt-6">
      <h2 id="estoque-title" className="text-xs font-semibold tracking-wide text-mist uppercase">
        {stockTitle}
      </h2>
      <ul className="-mx-4 mt-3 flex gap-2 overflow-x-hidden px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {STOCK_ALERT_CATEGORIES.map((category) => (
          <li key={category} className="flex shrink-0 items-center gap-2 rounded-full border border-line bg-white/[0.03] py-1.5 pr-3 pl-2.5 text-sm text-mist">
            <span aria-hidden className="size-2 rounded-full bg-white/15" />
            <span className="font-medium text-fog">{STOCK_ALERT_CATEGORY_LABEL[category]}</span>
            <span aria-hidden className="h-3 w-16 rounded-full bg-white/[0.08] motion-safe:animate-pulse" />
          </li>
        ))}
      </ul>
      <span aria-hidden className="mt-3 block h-10 w-48 rounded-full border border-line bg-white/[0.03] motion-safe:animate-pulse" />
      <span className="sr-only">Carregando o estoque</span>
    </section>
  );
}
