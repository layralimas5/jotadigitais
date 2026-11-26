import { ShoppingBag, Wallet } from "lucide-react";
import { formatBRL } from "@/domain/money";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { useDocumentMeta } from "@/ui/hooks/useDocumentMeta";
import { AffiliateSpinner } from "../AffiliateLayout";
import { PayoutCard } from "../components/AffiliateRewards";
import { PanelSection } from "../components/AffiliateUi";
import { useAffiliateHome } from "../useAffiliateHome";

const paidDay = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

/** Pagamentos: o que está liberado, o "Pedir pagamento" e tudo o que a loja já pagou (Pix ou saldo usado numa compra). */
export default function AffiliateEarningsPage() {
  useDocumentMeta("Pagamentos | Painel do afiliado");
  const { home, reload } = useAffiliateHome();
  if (home.status === "loading") return <AffiliateSpinner />;
  if (home.status === "error") return <ErrorState message={home.error.message} onRetry={home.retry} />;
  const data = home.data;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-white sm:text-3xl">Pagamentos</h1>
        <p className="mt-2 max-w-2xl text-sm text-fog">Você ganha em cada venda. Quando a garantia acaba, o valor fica liberado e você pede o pagamento por Pix.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] [&>*]:min-w-0">
        <PayoutCard home={data} onChanged={reload} title="Seu saldo" />
        <PanelSection title="Pagamentos recebidos">
          {data.payouts.length === 0 ? (
            <EmptyState title="Nenhum pagamento ainda" description="Quando a loja pagar, cada Pix aparece aqui com a data e o valor." />
          ) : (
            <ul className="divide-y divide-line rounded-2xl border border-line">
              {data.payouts.map((payout) => {
                const Icon = payout.usedInPurchase ? ShoppingBag : Wallet;
                return (
                  <li key={payout.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <Icon aria-hidden className="size-4 shrink-0 text-electric" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-white">{payout.usedInPurchase ? "Saldo usado numa compra" : "Pix recebido"}</span>
                      <span className="block truncate text-xs text-mist">
                        {paidDay.format(new Date(payout.paidAt))} · {payout.commissionsCount} {payout.commissionsCount === 1 ? "venda" : "vendas"}
                        {payout.note ? ` · ${payout.note}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 font-display font-bold text-white tabular-nums">{formatBRL(payout.amount)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </PanelSection>
      </div>
    </div>
  );
}
