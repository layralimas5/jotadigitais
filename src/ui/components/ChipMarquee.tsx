import { useReducedMotion } from "framer-motion";
import { type ReactNode } from "react";
import { useDraggableMarquee } from "@/ui/hooks/useDraggableMarquee";
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
 * Faixa de botões em loop contínuo para a esquerda que o cliente também pode arrastar até a opção que quiser.
 * Toda cópia aceita clique (é a que estiver na tela), mas só a primeira vale para teclado e leitor de tela.
 * Pausa no hover e no foco pelo teclado; com movimento reduzido vira rolagem manual.
 */
export function ChipMarquee({ children, label, durationSeconds = 24, repeat = 3, className }: ChipMarqueeProps) {
  const reduceMotion = useReducedMotion();
  const { viewportRef, trackRef, viewportProps } = useDraggableMarquee(durationSeconds * repeat);

  if (reduceMotion) {
    return (
      <div role="group" aria-label={label} className={cn("flex gap-2 overflow-x-auto [scrollbar-width:none]", className)}>
        {children(false)}
      </div>
    );
  }

  const copies = Array.from({ length: repeat * 2 }, (_, index) => index);
  return (
    <div
      ref={viewportRef}
      {...viewportProps}
      className={cn("cursor-grab touch-pan-y overflow-hidden py-0.5 select-none active:cursor-grabbing", EDGE_FADE, className)}
    >
      <div ref={trackRef} className="flex w-max will-change-transform">
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
