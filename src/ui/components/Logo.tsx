import { cn } from "@/ui/lib/cn";
import { VerifiedBadge } from "./VerifiedBadge";

type LogoSize = "sm" | "md" | "lg";

const wordSize: Record<LogoSize, string> = {
  sm: "text-[1.2rem] leading-[0.95]",
  md: "text-[1.75rem] leading-[0.95]",
  lg: "text-[clamp(3rem,9vw,6.5rem)] leading-[0.9]",
};

const badgeSize: Record<LogoSize, string> = {
  sm: "size-6 ml-0.5 translate-y-1",
  md: "size-8 ml-1 translate-y-1.5",
  lg: "size-[0.58em] -ml-[0.06em] translate-y-[0.3em]",
};

/**
 * Releitura do wordmark do Canva: camadas rosa e azul deslocadas.
 * No tamanho grande as letras são em contorno (como o original); no pequeno ficam preenchidas para manter a leitura.
 */
function LayeredWord({ children, size }: { children: string; size: LogoSize }) {
  const outlined = size === "lg";
  const offset = outlined ? "0.045em" : "1.5px";
  const back = outlined
    ? { WebkitTextStroke: "2px var(--color-pink)", color: "transparent" }
    : { color: "var(--color-pink)" };
  const front = outlined
    ? { WebkitTextStroke: "2px var(--color-electric)", color: "transparent" }
    : { color: "var(--color-electric)" };
  return (
    <span className="relative inline-block">
      <span aria-hidden className="absolute inset-0 select-none" style={{ ...back, transform: `translate(${offset}, ${offset})` }}>
        {children}
      </span>
      <span className="relative" style={front}>
        {children}
      </span>
    </span>
  );
}

interface LogoProps {
  size?: LogoSize;
  className?: string;
}

export function Logo({ size = "sm", className }: LogoProps) {
  return (
    <span className={cn("inline-flex items-start font-logo tracking-tight uppercase", wordSize[size], className)}>
      <span className="sr-only">Jota Digitais</span>
      <span aria-hidden className="flex flex-col items-start">
        <LayeredWord size={size}>Jota</LayeredWord>
        <LayeredWord size={size}>Digitais</LayeredWord>
      </span>
      <VerifiedBadge className={cn("self-end", badgeSize[size])} />
    </span>
  );
}
