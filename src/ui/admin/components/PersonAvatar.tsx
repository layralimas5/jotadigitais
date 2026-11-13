import { useState } from "react";
import { cn } from "@/ui/lib/cn";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] ?? ""}${parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : ""}`.toUpperCase();
}

interface PersonAvatarProps {
  name: string;
  /** Foto de perfil; sem ela (ou se não carregar), ficam as iniciais. */
  src?: string | null;
  className?: string;
}

/** Foto ou círculo com as iniciais da pessoa. Decorativo: o nome sempre aparece ao lado. */
export function PersonAvatar({ name, src, className }: PersonAvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showPhoto = Boolean(src) && src !== failedSrc;
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-violet to-pink font-display text-xs font-semibold text-white",
        className,
      )}
    >
      {showPhoto && src ? (
        <img src={src} alt="" decoding="async" onError={() => setFailedSrc(src)} className="size-full object-cover" />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
}
