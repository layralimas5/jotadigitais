import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Account } from "@/domain/account";
import { formatBRL } from "@/domain/money";
import { MAX_CARD_INSTALLMENTS } from "@/domain/order";
import { ButtonLink } from "@/ui/components/Button";
import { CartToggleIcon } from "@/ui/components/cart/AddToCartButton";
import { useSiteContent } from "@/ui/hooks/useSiteContent";
import { editable } from "@/ui/lib/site-preview";
import { useEffect } from "react";

interface MobileBuyBarProps {
  account: Account;
  visible: boolean;
}

/** Marca na página que a barra está aberta: o botão do WhatsApp sobe para cima dela em vez de cobrir o "Comprar". */
const BUY_BAR_FLAG = "buybar";

/** Aparece no celular quando o botão de compra principal sai da tela. */
export function MobileBuyBar({ account, visible }: MobileBuyBarProps) {
  const reduceMotion = useReducedMotion();
  const { accountPage } = useSiteContent();
  useEffect(() => {
    if (!visible) return;
    document.body.dataset[BUY_BAR_FLAG] = "on";
    return () => {
      delete document.body.dataset[BUY_BAR_FLAG];
    };
  }, [visible]);
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={reduceMotion ? false : { y: "100%" }}
          animate={{ y: 0 }}
          exit={reduceMotion ? undefined : { y: "100%" }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-night/90 px-4 py-3 backdrop-blur-xl lg:hidden"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs text-mist">{account.displayName}</p>
              <p className="font-display text-base font-bold whitespace-nowrap text-white tabular-nums min-[380px]:text-lg">{formatBRL(account.price)}</p>
              <p className="text-[0.65rem] text-mist">Pix ou até {MAX_CARD_INSTALLMENTS}x</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <CartToggleIcon account={account} />
              <ButtonLink to={`/checkout/${account.slug}`} className="shrink-0" {...editable("accountPage.mobileBuyButton")}>
                {accountPage.mobileBuyButton}
              </ButtonLink>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
