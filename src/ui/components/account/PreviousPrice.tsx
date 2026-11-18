import { discountPercentOf, type AccountBase } from "@/domain/account";
import { formatBRL } from "@/domain/money";
import { cn } from "@/ui/lib/cn";

interface PreviousPriceProps {
  account: Pick<AccountBase, "price" | "compareAtPrice">;
  /** Selo "-9%" ao lado do valor riscado. */
  withPercent?: boolean;
  className?: string;
}

/** Valor anterior riscado da oferta ("de R$ 550,00"). Nada aparece quando a conta não está em oferta. */
export function PreviousPrice({ account, withPercent = true, className }: PreviousPriceProps) {
  const percent = discountPercentOf(account);
  if (percent === null || account.compareAtPrice === null) return null;
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", className)}>
      <span className="sr-only">Antes</span>
      <s className="text-mist tabular-nums decoration-mist/80">{formatBRL(account.compareAtPrice)}</s>
      {withPercent && (
        <span className="rounded-full bg-emerald-400/15 px-1.5 py-px text-[0.68rem] font-bold text-emerald-300 tabular-nums">
          -{percent}%
        </span>
      )}
      <span className="sr-only">, agora</span>
    </span>
  );
}
