import { useReducedMotion } from "framer-motion";
import { type CSSProperties, type ReactNode } from "react";
import { cn } from "@/ui/lib/cn";

interface ChipMarqueeProps {
  /** Desenha uma cópia dos itens. Nas repetidas (`repeated`), os botões ficam fora do Tab com tabIndex -1. */
  children: (repeated: boolean) => ReactNode;
  label: string;
  /** Segundos para os itens passarem uma vez. Maior = mais devagar. */
  durationSeconds?: number;
  /** Cópias em cada metade da faixa: uma metade precisa ser mais larga que a área visível. */
  repeat?: number;
  className?: string;
}

const EDGE_FADE = "[mask-image:linear-gradient(to_right,transparent,black_4%,black_96%,transparent)]";

/**
 * Faixa de botões em loop contínuo para a esquerda (mesma animação do Marquee dos depoimentos).
 * Toda cópia aceita clique (é a que estiver na tela), mas só a primeira vale para teclado e leitor de tela.
 * Pausa no hover e no foco pelo teclado; com movimento reduzido vira rolagem manual.
 */
export function ChipMarquee({ children, label, durationSeconds = 12, repeat = 3, className }: ChipMarqueeProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return (
      <div role="group" aria-label={label} className={cn("flex gap-2 overflow-x-auto [scrollbar-width:none]", className)}>
        {children(false)}
      </div>
    );
  }

  const style = { "--marquee-duration": `${durationSeconds * repeat}s` } as CSSProperties;
  const copies = Array.from({ length: repeat * 2 }, (_, index) => index);
  return (
    <div className={cn("group/chips overflow-hidden py-0.5", EDGE_FADE, className)}>
      <div
        className="flex w-max animate-marquee group-hover/chips:[animation-play-state:paused] group-has-[:focus-visible]/chips:[animation-play-state:paused]"
        style={style}
      >
        {copies.map((copy) =>
          copy === 0 ? (
            <div key={copy} role="group" aria-label={label} className="flex shrink-0 gap-2 pr-2">
              {children(false)}
            </div>
          ) : (
            <div key={copy} aria-hidden className="flex shrink-0 gap-2 pr-2">
              {children(true)}
            </div>
          ),
        )}
      </div>
    </div>
  );
}
