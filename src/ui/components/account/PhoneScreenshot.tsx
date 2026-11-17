import type { SyntheticEvent } from "react";
import { cn } from "@/ui/lib/cn";

interface PhoneScreenshotProps {
  src: string;
  alt: string;
  className?: string;
  /** Tamanho real do print, para não pular a moldura enquanto carrega. */
  width?: number;
  height?: number;
  onLoad?: (event: SyntheticEvent<HTMLImageElement>) => void;
}

/**
 * Print em pé dentro da moldura de celular. A moldura acompanha o formato do print: ele aparece inteiro,
 * sem corte nas laterais e sem zoom, seja qual for o aparelho em que foi tirado. O print já traz a barra de status.
 */
export function PhoneScreenshot({ src, alt, className, width, height, onLoad }: PhoneScreenshotProps) {
  return (
    <div
      className={cn(
        "relative inline-block rounded-[2.6rem] border border-white/15 bg-gradient-to-b from-zinc-800 to-zinc-950 p-2.5 shadow-[0_40px_120px_-30px_rgb(39_153_255/0.55)]",
        className,
      )}
    >
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        decoding="async"
        onLoad={onLoad}
        className="block h-auto max-h-[30rem] w-auto max-w-[16.25rem] rounded-[2.1rem] bg-zinc-950 sm:max-h-[34rem]"
      />
    </div>
  );
}
