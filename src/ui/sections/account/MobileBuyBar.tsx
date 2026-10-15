import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Account } from "@/domain/account";
import { formatBRL } from "@/domain/money";
import { MAX_CARD_INSTALLMENTS } from "@/domain/order";
import { ButtonLink } from "@/ui/components/Button";
import { useStoreSettings } from "@/ui/hooks/useStoreSettings";
import { cn } from "@/ui/lib/cn";

interface MobileBuyBarProps {
  account: Account;
  visible: boolean;
}

/** Aparece no celular quando o botão de compra principal sai da tela. */
export function MobileBuyBar({ account, visible }: MobileBuyBarProps) {
  const reduceMotion = useReducedMotion();
  const { whatsappUrl } = useStoreSettings();
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={reduceMotion ? false : { y: "100%" }}
          animate={{ y: 0 }}
          exit={reduceMotion ? undefined : { y: "100%" }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            "fixed inset-x-0 bottom-0 z-30 border-t border-line bg-night/90 py-3 pl-4 backdrop-blur-xl lg:hidden",
            whatsappUrl ? "pr-[5.5rem]" : "pr-4",
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs text-mist">{account.displayName}</p>
              <p className="font-display text-lg font-bold text-white tabular-nums">{formatBRL(account.price)}</p>
              <p className="text-[0.65rem] text-mist">Pix ou até {MAX_CARD_INSTALLMENTS}x</p>
            </div>
            <ButtonLink to={`/checkout/${account.slug}`} className="shrink-0">
              Comprar
            </ButtonLink>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
