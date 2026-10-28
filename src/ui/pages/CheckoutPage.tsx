import { ArrowLeft, Lock, MessageCircle } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { CheckoutData } from "@/application/schemas";
import { formatCount, isPurchasable, type Account } from "@/domain/account";
import { formatBRL } from "@/domain/money";
import { acceptsPix } from "@/domain/store-settings";
import { Button, ButtonLink } from "@/ui/components/Button";
import { AccountAvatar } from "@/ui/components/account/AccountAvatar";
import { AccountBadgePill, PlatformTag } from "@/ui/components/account/AccountBadges";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { useCheckoutForm } from "@/ui/hooks/useCheckoutForm";
import { useDocumentMeta } from "@/ui/hooks/useDocumentMeta";
import { useAccount, usePlaceOrder } from "@/ui/hooks/useStore";
import { useStoreSettings } from "@/ui/hooks/useStoreSettings";
import { accountBadge, audienceLabel } from "@/ui/lib/account-presenter";
import { CheckoutPaymentStep } from "@/ui/sections/checkout/CheckoutPaymentStep";
import { CheckoutProfileFields } from "@/ui/sections/checkout/CheckoutProfileFields";

function OrderSummary({ account }: { account: Account }) {
  return (
    <aside aria-labelledby="resumo-title" className="rounded-3xl border border-line bg-surface p-5 sm:p-6 lg:sticky lg:top-24">
      <h2 id="resumo-title" className="font-display text-lg font-semibold text-white">
        Resumo do pedido
      </h2>
      <div className="mt-5 flex items-center gap-3 rounded-2xl border border-line bg-ink/60 p-4">
        <AccountAvatar account={account} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-white">{account.displayName}</p>
          <p className="truncate text-sm text-mist">
            {account.handle} · {formatCount(account.followers)} {audienceLabel(account).toLowerCase()}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <PlatformTag platform={account.platform} />
        <AccountBadgePill badge={accountBadge(account)} />
      </div>

      <dl className="mt-6 space-y-3 border-t border-line pt-5 text-sm">
        <div className="flex justify-between text-mist">
          <dt>Conta</dt>
          <dd className="tabular-nums">{formatBRL(account.price)}</dd>
        </div>
        <div className="flex justify-between text-mist">
          <dt>Entrega</dt>
          <dd>Pelo WhatsApp</dd>
        </div>
        <div className="flex items-baseline justify-between border-t border-line pt-4">
          <dt className="font-semibold text-white">Total</dt>
          <dd className="font-display text-2xl font-bold text-white tabular-nums">{formatBRL(account.price)}</dd>
        </div>
      </dl>

      <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-mist">
        <MessageCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-electric" />
        Com o pagamento confirmado, login, senha e o passo a passo chegam no seu WhatsApp.
      </p>
    </aside>
  );
}

function CheckoutForm({ account }: { account: Account }) {
  const navigate = useNavigate();
  const placeOrder = usePlaceOrder();
  const submitting = placeOrder.state.status === "submitting";

  const onValid = async (data: CheckoutData) => {
    const placed = await placeOrder.submit(account.id, data);
    if (placed) navigate(`/pedido/${placed.order.code}`, { replace: true });
  };
  const { values, errors, setField, handleSubmit } = useCheckoutForm(account.price, onValid);
  const pixEnabled = acceptsPix(useStoreSettings());

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-8 sm:space-y-10" aria-busy={submitting}>
      <CheckoutProfileFields values={values} errors={errors} setField={setField} />
      <CheckoutPaymentStep total={account.price} pixEnabled={pixEnabled} values={values} errors={errors} setField={setField} />

      {placeOrder.state.status === "error" && (
        <p role="alert" className="rounded-2xl border border-alert/30 bg-alert/[0.07] p-4 text-sm text-white">
          {placeOrder.state.message}
        </p>
      )}

      <div>
        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? (
            <>
              <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink" />
              Registrando pedido…
            </>
          ) : (
            <>
              <Lock aria-hidden className="size-4" /> Finalizar compra · {formatBRL(account.price)}
            </>
          )}
        </Button>
        <p className="mt-3 text-center text-xs text-mist">Seus dados são usados só para entregar a conta e dar suporte.</p>
      </div>
    </form>
  );
}

function CheckoutContent({ account }: { account: Account }) {
  useDocumentMeta(`Checkout ${account.handle}`);
  if (!isPurchasable(account)) {
    return (
      <EmptyState
        title="Esta conta não está mais disponível"
        description="Outra pessoa reservou ou comprou antes. Escolha outra conta na vitrine."
        action={<ButtonLink to="/contas">Ver contas disponíveis</ButtonLink>}
      />
    );
  }
  return (
    <div className="grid grid-cols-1 gap-8 sm:gap-10 lg:grid-cols-[1.35fr_1fr] lg:gap-14">
      <CheckoutForm account={account} />
      <div className="order-first lg:order-none">
        <OrderSummary account={account} />
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  const { slug = "" } = useParams();
  const account = useAccount(slug);

  return (
    <div className="relative pt-24 pb-24 md:pt-32">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <Link
          to={`/contas/${slug}`}
          className="inline-flex items-center gap-2 text-sm text-mist transition-colors hover:text-white"
        >
          <ArrowLeft aria-hidden className="size-4" /> Voltar para a conta
        </Link>
        <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight text-white md:text-4xl">
          Finalizar compra
        </h1>
        <div className="mt-10">
          {account.status === "loading" && (
            <div aria-busy="true" className="grid grid-cols-1 gap-10 lg:grid-cols-[1.35fr_1fr]">
              <div className="h-[32rem] animate-pulse rounded-3xl bg-white/[0.04]" />
              <div className="h-80 animate-pulse rounded-3xl bg-white/[0.04]" />
            </div>
          )}
          {account.status === "error" && <ErrorState message={account.error.message} onRetry={account.retry} />}
          {account.status === "success" && <CheckoutContent account={account.data} />}
        </div>
      </div>
    </div>
  );
}
