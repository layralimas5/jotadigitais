import { ArrowLeft, CreditCard, Lock, Mail, QrCode } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { CheckoutData } from "@/application/schemas";
import { formatCount, isPurchasable, shopTierOf, type TikTokAccount } from "@/domain/account";
import { formatBRL } from "@/domain/money";
import { MAX_CARD_INSTALLMENTS } from "@/domain/order";
import { Button, ButtonLink } from "@/ui/components/Button";
import { AccountAvatar } from "@/ui/components/account/AccountAvatar";
import { ShopTierBadge } from "@/ui/components/account/AccountBadges";
import { ChoiceCard, TextField } from "@/ui/components/form/Fields";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { useCheckoutForm, formatWhatsapp } from "@/ui/hooks/useCheckoutForm";
import { useDocumentMeta } from "@/ui/hooks/useDocumentMeta";
import { useAccount, usePlaceOrder } from "@/ui/hooks/useStore";

function OrderSummary({ account }: { account: TikTokAccount }) {
  return (
    <aside aria-labelledby="resumo-title" className="rounded-3xl border border-line bg-surface p-6 lg:sticky lg:top-24">
      <h2 id="resumo-title" className="font-display text-lg font-semibold text-white">
        Resumo do pedido
      </h2>
      <div className="mt-5 flex items-center gap-3 rounded-2xl border border-line bg-ink/60 p-4">
        <AccountAvatar account={account} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-white">{account.displayName}</p>
          <p className="truncate text-sm text-mist">
            {account.handle} · {formatCount(account.followers)} seguidores
          </p>
        </div>
      </div>
      <ShopTierBadge tier={shopTierOf(account)} className="mt-4" />

      <dl className="mt-6 space-y-3 border-t border-line pt-5 text-sm">
        <div className="flex justify-between text-mist">
          <dt>Conta TikTok</dt>
          <dd className="tabular-nums">{formatBRL(account.price)}</dd>
        </div>
        <div className="flex justify-between text-mist">
          <dt>Entrega</dt>
          <dd>Por e-mail</dd>
        </div>
        <div className="flex items-baseline justify-between border-t border-line pt-4">
          <dt className="font-semibold text-white">Total</dt>
          <dd className="font-display text-2xl font-bold text-white tabular-nums">{formatBRL(account.price)}</dd>
        </div>
      </dl>

      <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-mist">
        <Mail aria-hidden className="mt-0.5 size-4 shrink-0 text-electric" />
        Com o pagamento confirmado, login, senha e o passo a passo chegam no seu e-mail.
      </p>
    </aside>
  );
}

function CheckoutForm({ account }: { account: TikTokAccount }) {
  const navigate = useNavigate();
  const placeOrder = usePlaceOrder();
  const submitting = placeOrder.state.status === "submitting";

  const onValid = async (data: CheckoutData) => {
    const placed = await placeOrder.submit(account.id, data);
    if (placed) navigate(`/pedido/${placed.order.code}`, { replace: true });
  };
  const { values, errors, setField, handleSubmit } = useCheckoutForm(onValid);

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-10" aria-busy={submitting}>
      <fieldset className="space-y-5">
        <legend className="font-display text-lg font-semibold text-white">1. Seus dados</legend>
        <TextField
          label="Nome completo"
          name="name"
          autoComplete="name"
          value={values.name}
          onChange={(event) => setField("name", event.target.value)}
          error={errors.name}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            label="E-mail"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={values.email}
            onChange={(event) => setField("email", event.target.value)}
            error={errors.email}
            hint="É aqui que você recebe o acesso."
          />
          <TextField
            label="Confirme o e-mail"
            name="emailConfirmation"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={values.emailConfirmation}
            onChange={(event) => setField("emailConfirmation", event.target.value)}
            error={errors.emailConfirmation}
          />
        </div>
        <TextField
          label="WhatsApp (opcional)"
          name="whatsapp"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="(11) 91234-5678"
          value={values.whatsapp}
          onChange={(event) => setField("whatsapp", formatWhatsapp(event.target.value))}
          error={errors.whatsapp}
          hint="Só para suporte, se precisar."
        />
      </fieldset>

      <fieldset>
        <legend className="font-display text-lg font-semibold text-white">2. Pagamento</legend>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <ChoiceCard
            name="paymentMethod"
            value="pix"
            checked={values.paymentMethod === "pix"}
            onChange={() => setField("paymentMethod", "pix")}
            title="Pix"
            description={`${formatBRL(account.price)} à vista, aprovação imediata`}
            icon={<QrCode className="size-5" />}
          />
          <ChoiceCard
            name="paymentMethod"
            value="card"
            checked={values.paymentMethod === "card"}
            onChange={() => setField("paymentMethod", "card")}
            title="Cartão de crédito"
            description={`Em até ${MAX_CARD_INSTALLMENTS}x com juros da operadora`}
            icon={<CreditCard className="size-5" />}
          />
        </div>
      </fieldset>

      <div>
        <label className="flex cursor-pointer items-start gap-3 text-sm text-fog">
          <input
            type="checkbox"
            name="acceptedTerms"
            checked={values.acceptedTerms}
            onChange={(event) => setField("acceptedTerms", event.target.checked)}
            aria-invalid={errors.acceptedTerms ? true : undefined}
            aria-describedby={errors.acceptedTerms ? "terms-error" : undefined}
            className="mt-0.5 size-5 shrink-0 accent-electric"
          />
          <span>
            Li e aceito os{" "}
            <Link to="/termos" target="_blank" className="text-electric-soft underline underline-offset-4">
              termos de compra e garantia
            </Link>
            .
          </span>
        </label>
        {errors.acceptedTerms && (
          <p id="terms-error" className="mt-2 text-xs font-medium text-[#ff7a7a]">
            {errors.acceptedTerms}
          </p>
        )}
      </div>

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
        <p className="mt-3 text-center text-xs text-mist">Seus dados são usados só para entregar a conta.</p>
      </div>
    </form>
  );
}

function CheckoutContent({ account }: { account: TikTokAccount }) {
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
    <div className="grid gap-10 lg:grid-cols-[1.35fr_1fr] lg:gap-14">
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
            <div aria-busy="true" className="grid gap-10 lg:grid-cols-[1.35fr_1fr]">
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
