import type { SyntheticEvent } from "react";
import { useImageBottomColor } from "@/ui/hooks/useImageBottomColor";
import { cn } from "@/ui/lib/cn";

interface PhoneScreenshotProps {
  src: string;
  alt: string;
  className?: string;
  onLoad?: (event: SyntheticEvent<HTMLImageElement>) => void;
}

/**
 * Print em pé dentro da moldura de celular. A moldura tem sempre o mesmo tamanho (perfil, Central e os outros
 * prints ficam iguais); o print aparece inteiro, sem corte nem zoom, encostado no topo como numa tela de verdade.
 * Se ele for mais curto que a tela (print recortado), o resto da tela fica com a cor do fim do print.
 */
export function PhoneScreenshot({ src, alt, className, onLoad }: PhoneScreenshotProps) {
  const fill = useImageBottomColor(src);
  return (
    <div
      className={cn(
        "relative w-[17.5rem] rounded-[2.6rem] border border-white/15 bg-gradient-to-b from-zinc-800 to-zinc-950 p-2.5 shadow-[0_40px_120px_-30px_rgb(39_153_255/0.55)]",
        className,
      )}
    >
      <div
        className="relative aspect-[9/19.5] overflow-hidden rounded-[2.1rem] bg-zinc-950 transition-colors duration-300"
        style={fill ? { backgroundColor: fill } : undefined}
      >
        <img src={src} alt={alt} decoding="async" onLoad={onLoad} className="size-full object-contain object-top" />
      </div>
    </div>
  );
}
