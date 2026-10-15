import { cn } from "@/ui/lib/cn";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] ?? ""}${parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : ""}`.toUpperCase();
}

/** Círculo com as iniciais da pessoa. Decorativo: o nome sempre aparece ao lado. */
export function PersonAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet to-pink font-display text-xs font-semibold text-white",
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
