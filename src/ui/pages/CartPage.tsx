import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Lock, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { formatCount, isPurchasable, type Account } from "@/domain/account";
import { formatBRL } from "@/domain/money";
import { MAX_CARD_INSTALLMENTS, MAX_CART_ITEMS } from "@/domain/order";
import { ButtonLink } from "@/ui/components/Button";
import { AccountAvatar } from "@/ui/components/account/AccountAvatar";
import { PlatformTag } from "@/ui/components/account/AccountBadges";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { useCart } from "@/ui/hooks/useCart";
import { useDocumentMeta } from "@/ui/hooks/useDocumentMeta";
import { useCartAccounts } from "@/ui/hooks/useStore";
import { audienceLabel } from "@/ui/lib/account-presenter";
import { cn } from "@/ui/lib/cn";
import { subtotalOf } from "@/ui/sections/checkout/OrderSummary";

function CartItem({ account, onRemove }: { account: Account; onRemove: () => void }) {
  const available = isPurchasable(account);
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border bg-surface p-4 sm:gap-4 sm:p-5",
        available ? "border-line" : "border-alert/40 bg-alert/[0.04]",
      )}
    >
      <AccountAvatar account={account} className={cn(!available && "opacity-60")} />
      <div className="min-w-0 flex-1">
        <Link
          to={`/contas/${account.slug}`}
          className="block truncate font-semibold text-white underline-offset-4 hover:underline focus-visible:underline"
        >
          {account.displayName}
        </Link>
        <p className="truncate text-sm text-mist">
          {account.handle} · {formatCount(account.followers)} {audienceLabel(account).toLowerCase()}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <PlatformTag platform={account.platform} />
          {!available && <span className="text-xs font-semibold text-alert">Não está mais disponível</span>}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <p className={cn("font-display font-bold text-white tabular-nums sm:text-lg", !available && "text-mist line-through")}>
          {formatBRL(account.price)}
        </p>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Tirar ${account.handle} do carrinho`}
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs text-mist transition-colors hover:bg-white/[0.05] hover:text-white focus-visible:outline-2 focus-visible:outline-electric"
        >
          <Trash2 aria-hidden className="size-3.5" />
          Remover
        </button>
      </div>
    </div>
  );
}

function CartSummary({ accounts }: { accounts: readonly Account[] }) {
  const blocked = accounts.some((account) => !isPurchasable(account));
  return (
    <aside aria-labelledby="carrinho-resumo" className="rounded-3xl border border-line bg-surface p-5 sm:p-6 lg:sticky lg:top-24">
      <h2 id="carrinho-resumo" className="font-display text-lg font-semibold text-white">
        Resumo
      </h2>
      <dl className="mt-5 space-y-3 text-sm">
        <div className="flex justify-between text-mist">
          <dt>{accounts.length === 1 ? "1 conta" : `${accounts.length} contas`}</dt>
          <dd className="tabular-nums">{formatBRL(subtotalOf(accounts))}</dd>
        </div>
        <div className="flex justify-between text-mist">
          <dt>Entrega</dt>
          <dd>Pelo WhatsApp</dd>
        </div>
        <div className="flex items-baseline justify-between border-t border-line pt-4">
          <dt className="font-semibold text-white">Total</dt>
          <dd className="font-display text-2xl font-bold text-white tabular-nums">{formatBRL(subtotalOf(accounts))}</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-mist">Pix ou até {MAX_CARD_INSTALLMENTS}x no cartão. Cupom de desconto no próximo passo.</p>

      {blocked ? (
        <p role="alert" className="mt-5 rounded-2xl border border-alert/30 bg-alert/[0.07] p-3 text-sm text-white">
          Tire do carrinho as contas que não estão mais disponíveis para seguir.
        </p>
      ) : (
        <ButtonLink to="/checkout" size="lg" className="mt-5 w-full">
          <Lock aria-hidden className="size-4" /> Finalizar compra
        </ButtonLink>
      )}
      <ButtonLink to="/contas" variant="ghost" className="mt-2 w-full">
        Continuar escolhendo <ArrowRight aria-hidden className="size-4" />
      </ButtonLink>
      <p className="mt-4 text-center text-xs text-mist">
        Um pagamento só para todas. Até {MAX_CART_ITEMS} contas por pedido.
      </p>
    </aside>
  );
}

function CartSkeleton() {
  return (
    <div aria-busy="true" className="grid grid-cols-1 gap-8 lg:grid-cols-[1.5fr_1fr]">
      <div className="space-y-3">
        <div className="h-28 animate-pulse rounded-2xl bg-white/[0.04]" />
        <div className="h-28 animate-pulse rounded-2xl bg-white/[0.04]" />
      </div>
      <div className="h-72 animate-pulse rounded-3xl bg-white/[0.04]" />
    </div>
  );
}

function CartContent() {
  const cart = useCart();
  const accounts = useCartAccounts(cart.ids);
  const reduceMotion = useReducedMotion();

  if (cart.count === 0) {
    return (
      <EmptyState
        title="Seu carrinho está vazio"
        description="Na vitrine, toque no ícone de sacola de cada conta para juntar várias e pagar tudo de uma vez."
        action={<ButtonLink to="/contas">Ver contas</ButtonLink>}
      />
    );
  }
  if (accounts.status === "loading") return <CartSkeleton />;
  if (accounts.status === "error") return <ErrorState message={accounts.error.message} onRetry={accounts.retry} />;

  // Conta apagada do estoque some do carrinho sem aviso; a lista mostra só as que existem.
  const items = accounts.data.filter((account) => cart.has(account.id));
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.5fr_1fr] lg:gap-12">
      <ul aria-label="Contas no carrinho" className="space-y-3">
        <AnimatePresence initial={false}>
          {items.map((account) => (
            <motion.li
              key={account.id}
              layout={!reduceMotion}
              exit={reduceMotion ? undefined : { opacity: 0, x: -24, transition: { duration: 0.2 } }}
            >
              <CartItem account={account} onRemove={() => cart.remove(account.id)} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {items.length > 0 && <CartSummary accounts={items} />}
    </div>
  );
}

export default function CartPage() {
  useDocumentMeta("Carrinho");
  return (
    <div className="relative pt-24 pb-24 md:pt-32">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <Link to="/contas" className="inline-flex items-center gap-2 text-sm text-mist transition-colors hover:text-white">
          <ArrowLeft aria-hidden className="size-4" /> Voltar para a vitrine
        </Link>
        <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight text-white md:text-4xl">Carrinho</h1>
        <div className="mt-10">
          <CartContent />
        </div>
      </div>
    </div>
  );
}
