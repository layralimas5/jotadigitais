import { useCallback, useState } from "react";
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
 * Na prévia da aba Site não consulta nada (não há pedido de verdade).
 */
export function useCoupon(accountId: string, price: Cents, preview = false) {
  const [state, setState] = useState<CouponState>(IDLE);

  const apply = useCallback(
    async (code: string) => {
      if (preview) return;
      setState({ status: "checking", applied: null, error: null });
      try {
        const applied = await previewCoupon(container.store, code, accountId);
        setState({ status: "applied", applied, error: null });
      } catch (error) {
        setState({ status: "error", applied: null, error: messageOf(error) });
      }
    },
    [accountId, preview],
  );

  const remove = useCallback(() => setState(IDLE), []);

  return {
    state,
    apply,
    remove,
    /** Total que vai ser cobrado: com o desconto quando há cupom aplicado. */
    total: state.applied?.total ?? price,
    code: state.applied?.code ?? null,
  };
}

export type CouponController = ReturnType<typeof useCoupon>;
