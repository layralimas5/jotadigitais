import { animate, useReducedMotion } from "framer-motion";
import { TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { container } from "@/app/container";
import { getSoldTotal } from "@/application/use-cases";
import { useAsync } from "@/ui/hooks/useAsync";

const COUNT_UP_S = 1.4;
const formatCount = (value: number) => Math.round(value).toLocaleString("pt-BR");

function useCountUp(target: number | null): number {
  const reduceMotion = useReducedMotion();
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === null) return;
    if (reduceMotion) {
      setValue(target);
      return;
    }
    const controls = animate(0, target, { duration: COUNT_UP_S, ease: "easeOut", onUpdate: setValue });
    return () => controls.stop();
  }, [target, reduceMotion]);
  return value;
}

/**
 * "+3.043 contas vendidas" no topo da home: o total do Jota mais cada conta paga no site.
 * A altura fica reservada enquanto carrega para a página não pular.
 */
export function SoldCounter() {
  const sold = useAsync(() => getSoldTotal(container.store), "sold-total");
  const total = sold.status === "success" && sold.data > 0 ? sold.data : null;
  const shown = useCountUp(total);

  return (
    <div className="mt-5 flex h-8 justify-center sm:mt-6 lg:justify-start">
      {total !== null && (
        <p className="inline-flex h-8 items-center gap-2 rounded-full border border-electric/30 bg-electric/[0.08] px-3.5 text-sm text-fog">
          <TrendingUp aria-hidden className="size-4 text-electric" />
          <span>
            <span aria-hidden className="font-display font-semibold text-white tabular-nums">
              +{formatCount(shown)}
            </span>
            <span className="sr-only">Mais de {formatCount(total)}</span> contas vendidas
          </span>
        </p>
      )}
    </div>
  );
}
