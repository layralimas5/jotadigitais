import { useReducedMotion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/ui/lib/cn";

interface MarqueeProps {
  children: ReactNode;
  label: string;
  /** Segundos para uma volta completa. Maior = mais devagar. */
  durationSeconds?: number;
  className?: string;
}

const EDGE_FADE = "[mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]";

/**
 * Faixa em loop infinito para a esquerda. O conteúdo é duplicado e a faixa anda 50%,
 * então a emenda é invisível. Pausa no hover; com movimento reduzido vira rolagem manual.
 */
export function Marquee({ children, label, durationSeconds = 40, className }: MarqueeProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return (
      <div role="region" aria-label={label} className={cn("overflow-x-auto pb-4", className)}>
        <ul className="flex w-max gap-5 px-4 sm:px-6">{children}</ul>
      </div>
    );
  }

  const style = { "--marquee-duration": `${durationSeconds}s` } as CSSProperties;
  return (
    <div role="region" aria-label={label} className={cn("group/marquee overflow-hidden", EDGE_FADE, className)}>
      <div className="flex w-max animate-marquee group-hover/marquee:[animation-play-state:paused]" style={style}>
        <ul className="flex shrink-0 items-stretch gap-5 pr-5">{children}</ul>
        <ul aria-hidden className="flex shrink-0 items-stretch gap-5 pr-5">
          {children}
        </ul>
      </div>
    </div>
  );
}
