import { MessageCircle } from "lucide-react";
import { formatCount, type Account } from "@/domain/account";
import { formatBRL, type Cents } from "@/domain/money";
import { AccountAvatar } from "@/ui/components/account/AccountAvatar";
import { AccountBadgePill, PlatformTag } from "@/ui/components/account/AccountBadges";
import type { CouponController } from "@/ui/hooks/useCoupon";
import { accountBadge, audienceLabel } from "@/ui/lib/account-presenter";
import { CouponField } from "./CouponField";

export const subtotalOf = (accounts: readonly Account[]): Cents => accounts.reduce((sum, account) => sum + account.price, 0);

function AccountLine({ account, showPrice }: { account: Account; showPrice: boolean }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-line bg-ink/60 p-4">
      <AccountAvatar account={account} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-white">{account.displayName}</p>
        <p className="truncate text-sm text-mist">
          {account.handle} · {formatCount(account.followers)} {audienceLabel(account).toLowerCase()}
        </p>
      </div>
      {showPrice && <p className="shrink-0 text-sm font-semibold text-white tabular-nums">{formatBRL(account.price)}</p>}
    </li>
  );
}

interface OrderSummaryProps {
  accounts: readonly Account[];
  coupon: CouponController;
  preview: boolean;
}

/** Resumo ao lado do formulário: uma conta com as etiquetas dela, ou a lista do carrinho com o preço de cada uma. */
export function OrderSummary({ accounts, coupon, preview }: OrderSummaryProps) {
  const [single] = accounts;
  const isCart = accounts.length > 1;
  const subtotal = subtotalOf(accounts);

  return (
    <aside aria-labelledby="resumo-title" className="rounded-3xl border border-line bg-surface p-5 sm:p-6 lg:sticky lg:top-24">
      <h2 id="resumo-title" className="font-display text-lg font-semibold text-white">
        Resumo do pedido
      </h2>
      <ul className="mt-5 space-y-2">
        {accounts.map((account) => (
          <AccountLine key={account.id} account={account} showPrice={isCart} />
        ))}
      </ul>
      {!isCart && single && (
        <div className="mt-4 flex flex-wrap gap-2">
          <PlatformTag platform={single.platform} />
          <AccountBadgePill badge={accountBadge(single)} />
        </div>
      )}

      <dl className="mt-6 space-y-3 border-t border-line pt-5 text-sm">
        <div className="flex justify-between text-mist">
          <dt>{isCart ? `${accounts.length} contas` : "Conta"}</dt>
          <dd className="tabular-nums">{formatBRL(subtotal)}</dd>
        </div>
        {coupon.state.applied && (
          <div className="flex justify-between text-emerald-300">
            <dt>Cupom {coupon.state.applied.code}</dt>
            <dd className="tabular-nums">−{formatBRL(coupon.state.applied.discount)}</dd>
          </div>
        )}
        <div className="flex justify-between text-mist">
          <dt>Entrega</dt>
          <dd>Pelo WhatsApp</dd>
        </div>
        <div className="flex items-baseline justify-between border-t border-line pt-4">
          <dt className="font-semibold text-white">Total</dt>
          <dd className="flex items-baseline gap-2">
            {coupon.state.applied && <s className="text-sm text-mist tabular-nums">{formatBRL(subtotal)}</s>}
            <span className="font-display text-2xl font-bold text-white tabular-nums">{formatBRL(coupon.total)}</span>
          </dd>
        </div>
      </dl>

      <div className="mt-5">
        <CouponField coupon={coupon} disabled={preview} />
      </div>

      <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-mist">
        <MessageCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-electric" />
        {isCart
          ? "Com o pagamento confirmado, login, senha e o passo a passo de cada conta chegam no seu WhatsApp."
          : "Com o pagamento confirmado, login, senha e o passo a passo chegam no seu WhatsApp."}
      </p>
    </aside>
  );
}
