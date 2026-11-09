import { useCallback, useEffect, useState } from "react";
import { container } from "@/app/container";
import { ValidationError } from "@/application/schemas";
import { previewCoupon } from "@/application/use-cases";
import type { CouponPreview } from "@/domain/coupon";
import { CouponRejectedError } from "@/domain/errors";
import type { Cents } from "@/domain/money";

type CouponState =
  | { status: "idle"; applied: null; error: null }
  | { status: "checking"; applied: null; error: null }
  | { status: "applied"; applied: CouponPreview; error: null }
  | { status: "error"; applied: null; error: string };

const IDLE: CouponState = { status: "idle", applied: null, error: null };

function messageOf(error: unknown): string {
  if (error instanceof CouponRejectedError || error instanceof ValidationError) return error.message;
  console.error("Falha ao conferir o cupom", error);
  return "Não foi possível conferir o cupom agora. Tente de novo.";
}

/**
 * Cupom do checkout: confere no banco e guarda o desconto para mostrar no resumo e no botão.
 * No carrinho, o desconto vale sobre a soma das contas. Na prévia da aba Site não consulta nada.
 */
export function useCoupon(accountIds: readonly string[], subtotal: Cents, preview = false) {
  const [state, setState] = useState<CouponState>(IDLE);
  const cartKey = accountIds.join(",");

  // Mudou o que está sendo comprado: o desconto conferido antes não vale mais.
  useEffect(() => setState(IDLE), [cartKey]);

  const apply = useCallback(
    async (code: string) => {
      if (preview) return;
      setState({ status: "checking", applied: null, error: null });
      try {
        const applied = await previewCoupon(container.store, code, cartKey.split(","));
        setState({ status: "applied", applied, error: null });
      } catch (error) {
        setState({ status: "error", applied: null, error: messageOf(error) });
      }
    },
    [cartKey, preview],
  );

  const remove = useCallback(() => setState(IDLE), []);

  return {
    state,
    apply,
    remove,
    /** Total que vai ser cobrado: com o desconto quando há cupom aplicado. */
    total: state.applied?.total ?? subtotal,
    code: state.applied?.code ?? null,
  };
}

export type CouponController = ReturnType<typeof useCoupon>;
