import { ArrowLeft, Lock } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { CheckoutData } from "@/application/schemas";
import { isPurchasable, type Account } from "@/domain/account";
import { formatBRL } from "@/domain/money";
import { acceptsPix } from "@/domain/store-settings";
import { Button, ButtonLink } from "@/ui/components/Button";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { useCart } from "@/ui/hooks/useCart";
import { useCheckoutForm } from "@/ui/hooks/useCheckoutForm";
import { useCoupon, type CouponController } from "@/ui/hooks/useCoupon";
import { useDocumentMeta } from "@/ui/hooks/useDocumentMeta";
import { useAccount, useAccounts, useCartAccounts, usePlaceOrder } from "@/ui/hooks/useStore";
import { useStoreSettings } from "@/ui/hooks/useStoreSettings";
import { IS_SITE_PREVIEW, PREVIEW_ACCOUNT_SLUG } from "@/ui/lib/site-preview";
import { CheckoutPaymentStep } from "@/ui/sections/checkout/CheckoutPaymentStep";
import { CheckoutProfileFields, useCheckoutSources } from "@/ui/sections/checkout/CheckoutProfileFields";
import { OrderSummary, subtotalOf } from "@/ui/sections/checkout/OrderSummary";

interface CheckoutFormProps {
  accounts: readonly Account[];
  coupon: CouponController;
  preview: boolean;
  /** Pedido registrado: o carrinho tira as contas compradas. */
  onPlaced?: (accountIds: string[]) => void;
}

/** Na prévia da aba Site, o formulário só mostra: finalizar não registra pedido. */
function CheckoutForm({ accounts, coupon, preview, onPlaced }: CheckoutFormProps) {
  const navigate = useNavigate();
  const placeOrder = usePlaceOrder();
  const submitting = placeOrder.state.status === "submitting";
  const { defaultSource } = useCheckoutSources();

  const onValid = async (data: CheckoutData) => {
    if (preview) return;
    const accountIds = accounts.map((account) => account.id);
    const placed = await placeOrder.submit(accountIds, { ...data, couponCode: coupon.code });
    if (!placed) return;
    navigate(`/pedido/${placed.order.code}`, { replace: true });
    onPlaced?.(accountIds);
  };
  const { values, errors, setField, handleSubmit } = useCheckoutForm(coupon.total, onValid, defaultSource);
  const pixEnabled = acceptsPix(useStoreSettings());

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-8 sm:space-y-10" aria-busy={submitting}>
      <CheckoutProfileFields values={values} errors={errors} setField={setField} />
      <CheckoutPaymentStep total={coupon.total} pixEnabled={pixEnabled} values={values} errors={errors} setField={setField} />

      {placeOrder.state.status === "error" && (
        <p role="alert" className="rounded-2xl border border-alert/30 bg-alert/[0.07] p-4 text-sm text-white">
          {placeOrder.state.message}
        </p>
      )}

      <div>
        <Button type="submit" size="lg" className="w-full" disabled={submitting || preview || coupon.state.status === "checking"}>
          {submitting || coupon.state.status === "checking" ? (
            <>
              <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink" />
              {submitting ? "Registrando pedido…" : "Conferindo o cupom…"}
            </>
          ) : (
            <>
              <Lock aria-hidden className="size-4" /> Finalizar compra · {formatBRL(coupon.total)}
            </>
          )}
        </Button>
        <p className="mt-3 text-center text-xs text-mist">Seus dados são usados só para entregar a conta e dar suporte.</p>
      </div>
    </form>
  );
}

interface CheckoutContentProps {
  accounts: readonly Account[];
  preview?: boolean;
  onPlaced?: (accountIds: string[]) => void;
}

function CheckoutContent({ accounts, preview = false, onPlaced }: CheckoutContentProps) {
  const isCart = accounts.length > 1;
  const [first] = accounts;
  useDocumentMeta(isCart || !first ? `Checkout de ${accounts.length} contas` : `Checkout ${first.handle}`);
  const coupon = useCoupon(
    accounts.map((account) => account.id),
    subtotalOf(accounts),
    preview,
  );
  const unavailable = preview ? [] : accounts.filter((account) => !isPurchasable(account));

  if (unavailable.length > 0) {
    return isCart ? (
      <EmptyState
        title="Uma conta do carrinho não está mais disponível"
        description={`Outra pessoa reservou ou comprou antes: ${unavailable.map((account) => account.handle).join(", ")}. Tire do carrinho para seguir com as outras.`}
        action={<ButtonLink to="/carrinho">Voltar para o carrinho</ButtonLink>}
      />
    ) : (
      <EmptyState
        title="Esta conta não está mais disponível"
        description="Outra pessoa reservou ou comprou antes. Escolha outra conta na vitrine."
        action={<ButtonLink to="/contas">Ver contas disponíveis</ButtonLink>}
      />
    );
  }
  return (
    <div className="grid grid-cols-1 gap-8 sm:gap-10 lg:grid-cols-[1.35fr_1fr] lg:gap-14">
      <CheckoutForm accounts={accounts} coupon={coupon} preview={preview} onPlaced={onPlaced} />
      <div className="order-first lg:order-none">
        <OrderSummary accounts={accounts} coupon={coupon} preview={preview} />
      </div>
    </div>
  );
}

function CheckoutSkeleton() {
  return (
    <div aria-busy="true" className="grid grid-cols-1 gap-10 lg:grid-cols-[1.35fr_1fr]">
      <div className="h-[32rem] animate-pulse rounded-3xl bg-white/[0.04]" />
      <div className="h-80 animate-pulse rounded-3xl bg-white/[0.04]" />
    </div>
  );
}

function SingleCheckout({ slug }: { slug: string }) {
  const account = useAccount(slug);
  const cart = useCart();
  return (
    <>
      {account.status === "loading" && <CheckoutSkeleton />}
      {account.status === "error" && <ErrorState message={account.error.message} onRetry={account.retry} />}
      {account.status === "success" && <CheckoutContent accounts={[account.data]} onPlaced={cart.clear} />}
    </>
  );
}

/** Checkout do carrinho: todas as contas num pedido, um pagamento só. */
function CartCheckout() {
  const cart = useCart();
  const accounts = useCartAccounts(cart.ids);
  if (cart.count === 0) {
    return (
      <EmptyState
        title="Seu carrinho está vazio"
        description="Escolha as contas na vitrine e adicione ao carrinho para pagar tudo de uma vez."
        action={<ButtonLink to="/contas">Ver contas</ButtonLink>}
      />
    );
  }
  return (
    <>
      {accounts.status === "loading" && <CheckoutSkeleton />}
      {accounts.status === "error" && <ErrorState message={accounts.error.message} onRetry={accounts.retry} />}
      {accounts.status === "success" && <CheckoutContent accounts={accounts.data} onPlaced={cart.clear} />}
    </>
  );
}

/** Prévia da aba Site: checkout da primeira conta da vitrine, sem registrar pedido. */
function CheckoutPreview() {
  const accounts = useAccounts({});
  const first = accounts.status === "success" ? accounts.data[0] : undefined;
  return (
    <>
      {accounts.status === "loading" && <CheckoutSkeleton />}
      {accounts.status === "error" && <ErrorState message={accounts.error.message} onRetry={accounts.retry} />}
      {accounts.status === "success" && !first && (
        <EmptyState title="Nenhuma conta no estoque" description="Cadastre uma conta em Contas para ver o checkout." />
      )}
      {first && <CheckoutContent accounts={[first]} preview />}
    </>
  );
}

/** `/checkout/:slug` compra uma conta; `/checkout` compra o carrinho. */
export default function CheckoutPage() {
  const { slug } = useParams();
  const preview = IS_SITE_PREVIEW && slug === PREVIEW_ACCOUNT_SLUG;

  return (
    <div className="relative pt-24 pb-24 md:pt-32">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <Link
          to={slug ? `/contas/${slug}` : "/carrinho"}
          className="inline-flex items-center gap-2 text-sm text-mist transition-colors hover:text-white"
        >
          <ArrowLeft aria-hidden className="size-4" /> {slug ? "Voltar para a conta" : "Voltar para o carrinho"}
        </Link>
        <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight text-white md:text-4xl">
          Finalizar compra
        </h1>
        <div className="mt-10">
          {preview ? <CheckoutPreview /> : slug ? <SingleCheckout slug={slug} /> : <CartCheckout />}
        </div>
      </div>
    </div>
  );
}
