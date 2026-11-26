import { ErrorState } from "@/ui/components/StateViews";
import { useDocumentMeta } from "@/ui/hooks/useDocumentMeta";
import { AffiliateSpinner } from "../AffiliateLayout";
import { BalanceCouponCard } from "../components/AffiliateRewards";
import { PanelSection } from "../components/AffiliateUi";
import { useAffiliateHome } from "../useAffiliateHome";

const STEPS = [
  "Gere o código de saldo: ele vale o seu saldo liberado inteiro.",
  "Escolha na vitrine uma conta que custe mais que o saldo.",
  "No checkout, digite o código no campo de cupom. Você paga só a diferença.",
  "Pago o pedido, o saldo aparece como usado em Pagamentos.",
];

/** Comprar conta com o saldo: o código de uso único e o passo a passo. */
export default function AffiliateBalancePage() {
  useDocumentMeta("Comprar com saldo | Painel do afiliado");
  const { home, reload } = useAffiliateHome();
  if (home.status === "loading") return <AffiliateSpinner />;
  if (home.status === "error") return <ErrorState message={home.error.message} onRetry={home.retry} />;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-white sm:text-3xl">Comprar com saldo</h1>
        <p className="mt-2 max-w-2xl text-sm text-fog">Seu saldo de comissão pode virar uma conta para você, sem esperar o Pix.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] [&>*]:min-w-0">
        <BalanceCouponCard home={home.data} onChanged={reload} />
        <PanelSection title="Como funciona">
          <ol className="space-y-3 text-sm text-fog">
            {STEPS.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full bg-electric/15 text-xs font-semibold text-electric-soft">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </PanelSection>
      </div>
    </div>
  );
}
