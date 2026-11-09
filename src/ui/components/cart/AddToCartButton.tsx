import { Check, ShoppingBag } from "lucide-react";
import { isPurchasable, type Account } from "@/domain/account";
import { MAX_CART_ITEMS } from "@/domain/order";
import { Button, ButtonLink } from "@/ui/components/Button";
import { useOptionalCart } from "@/ui/hooks/useCart";
import { cn } from "@/ui/lib/cn";

const FULL_MESSAGE = `O carrinho aceita até ${MAX_CART_ITEMS} contas por pedido.`;

/**
 * Botão redondo do card da vitrine: põe ou tira a conta do carrinho sem sair da lista.
 * Fica acima do link que cobre o card inteiro (z-10) para o clique não abrir a conta.
 */
export function CartToggleIcon({ account, className }: { account: Account; className?: string }) {
  const cart = useOptionalCart();
  if (!cart || !isPurchasable(account)) return null;
  const inCart = cart.has(account.id);
  const blocked = !inCart && cart.full;
  const label = inCart ? `Tirar ${account.handle} do carrinho` : `Adicionar ${account.handle} ao carrinho`;

  return (
    <button
      type="button"
      aria-pressed={inCart}
      aria-label={label}
      title={blocked ? FULL_MESSAGE : label}
      disabled={blocked}
      onClick={() => (inCart ? cart.remove(account.id) : cart.add(account.id))}
      className={cn(
        "relative z-10 grid size-9 shrink-0 place-items-center rounded-full border transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric disabled:cursor-not-allowed disabled:opacity-40 sm:size-10",
        inCart
          ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-300 hover:bg-emerald-400/25"
          : "border-line-strong bg-white/[0.03] text-white hover:border-electric hover:text-electric",
        className,
      )}
    >
      {inCart ? <Check aria-hidden className="size-4" /> : <ShoppingBag aria-hidden className="size-4" />}
    </button>
  );
}

/** Botão largo da página da conta: adiciona e, depois de adicionada, leva ao carrinho. */
export function AddToCartButton({ account, className }: { account: Account; className?: string }) {
  const cart = useOptionalCart();
  if (!cart || !isPurchasable(account)) return null;

  if (cart.has(account.id)) {
    return (
      <ButtonLink to="/carrinho" variant="secondary" size="lg" className={cn("w-full", className)}>
        <Check aria-hidden className="size-4 text-emerald-300" />
        No carrinho · ver carrinho
      </ButtonLink>
    );
  }
  return (
    <div className={className}>
      <Button variant="secondary" size="lg" className="w-full" disabled={cart.full} onClick={() => cart.add(account.id)}>
        <ShoppingBag aria-hidden className="size-4" />
        Adicionar ao carrinho
      </Button>
      {cart.full && <p className="mt-2 text-center text-xs text-mist">{FULL_MESSAGE}</p>}
    </div>
  );
}
