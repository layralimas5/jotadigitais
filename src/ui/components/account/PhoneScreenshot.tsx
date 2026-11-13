import { cn } from "@/ui/lib/cn";

/** O print real do perfil dentro da mesma moldura de celular do mockup. O print já traz a barra de status do aparelho. */
export function PhoneScreenshot({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <div
      className={cn(
        "relative w-[17.5rem] rounded-[2.6rem] border border-white/15 bg-gradient-to-b from-zinc-800 to-zinc-950 p-2.5 shadow-[0_40px_120px_-30px_rgb(39_153_255/0.55)]",
        className,
      )}
    >
      <div className="relative aspect-[9/19.5] overflow-hidden rounded-[2.1rem] bg-zinc-950">
        <img src={src} alt={alt} decoding="async" className="size-full object-cover object-top" />
      </div>
    </div>
  );
}
