import { useReducedMotion } from "framer-motion";
import { Fragment, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/ui/lib/cn";

interface MarqueeProps {
  children: ReactNode;
  label: string;
  /** Segundos para os itens passarem uma vez. Maior = mais devagar. */
  durationSeconds?: number;
  /**
   * Quantas vezes os itens se repetem em cada metade da faixa. Garante que uma metade
   * seja mais larga que qualquer tela, para nunca aparecer espaço vazio no fim do loop.
   */
  repeat?: number;
  className?: string;
}

const EDGE_FADE = "[mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]";

function Repeated({ children, times }: { children: ReactNode; times: number }) {
  return Array.from({ length: times }, (_, index) => <Fragment key={index}>{children}</Fragment>);
}

/**
 * Faixa em loop contínuo para a esquerda. As duas metades são idênticas e a faixa anda
 * exatamente 50%, então o último item emenda no primeiro sem salto nem espaço.
 * Pausa no hover; com movimento reduzido vira rolagem manual.
 */
export function Marquee({ children, label, durationSeconds = 40, repeat = 3, className }: MarqueeProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return (
      <div role="region" aria-label={label} className={cn("overflow-x-auto pb-4", className)}>
        <ul className="flex w-max gap-5 px-4 sm:px-6">{children}</ul>
      </div>
    );
  }

  const style = { "--marquee-duration": `${durationSeconds * repeat}s` } as CSSProperties;
  return (
    <div role="region" aria-label={label} className={cn("group/marquee overflow-hidden", EDGE_FADE, className)}>
      <div className="flex w-max animate-marquee group-hover/marquee:[animation-play-state:paused]" style={style}>
        <ul className="flex shrink-0 items-stretch gap-5 pr-5">
          <Repeated times={repeat}>{children}</Repeated>
        </ul>
        <ul aria-hidden className="flex shrink-0 items-stretch gap-5 pr-5">
          <Repeated times={repeat}>{children}</Repeated>
        </ul>
      </div>
    </div>
  );
}
