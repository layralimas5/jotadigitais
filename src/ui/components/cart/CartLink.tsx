import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ShoppingCart } from "lucide-react";
import { Link } from "react-router-dom";
import { useCart } from "@/ui/hooks/useCart";
import { cn } from "@/ui/lib/cn";

/** Atalho do carrinho no topo. Só aparece com conta dentro, para não ocupar o topo de quem compra uma só. */
export function CartLink({ className }: { className?: string }) {
  const { count } = useCart();
  const reduceMotion = useReducedMotion();
  if (count === 0) return null;
  const label = `Carrinho com ${count} ${count === 1 ? "conta" : "contas"}`;

  return (
    <Link
      to="/carrinho"
      aria-label={label}
      title={label}
      className={cn(
        "relative grid size-9 place-items-center rounded-full border border-line-strong bg-white/[0.03] text-white transition-colors hover:border-white/30 hover:bg-white/[0.07] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric sm:size-10",
        className,
      )}
    >
      <ShoppingCart aria-hidden className="size-4" />
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={count}
          aria-hidden
          initial={reduceMotion ? false : { scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={reduceMotion ? undefined : { scale: 0.4, opacity: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 28 }}
          className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-electric px-1 text-[0.68rem] leading-5 font-bold text-ink tabular-nums"
        >
          {count}
        </motion.span>
      </AnimatePresence>
    </Link>
  );
}
