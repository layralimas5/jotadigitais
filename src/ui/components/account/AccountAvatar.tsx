import type { Account } from "@/domain/account";
import { cn } from "@/ui/lib/cn";

const GRADIENTS = [
  "from-pink to-violet",
  "from-electric to-violet",
  "from-magenta to-electric",
  "from-violet to-pink",
  "from-electric-soft to-magenta",
] as const;

export function gradientFor(id: string): string {
  const hash = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return GRADIENTS[hash % GRADIENTS.length] ?? GRADIENTS[0];
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

interface AccountAvatarProps {
  account: Pick<Account, "id" | "displayName"> & { avatarUrl?: string | null };
  className?: string;
}

/** Foto de perfil da conta; sem foto cadastrada, as iniciais num degradê. */
export function AccountAvatar({ account, className }: AccountAvatarProps) {
  if (account.avatarUrl) {
    return (
      <img
        src={account.avatarUrl}
        alt=""
        loading="lazy"
        decoding="async"
        className={cn("size-12 shrink-0 rounded-full bg-surface object-cover ring-2 ring-white/10", className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-12 shrink-0 place-items-center rounded-full bg-gradient-to-br font-display text-sm font-bold text-white ring-2 ring-white/10",
        gradientFor(account.id),
        className,
      )}
    >
      {initialsOf(account.displayName)}
    </span>
  );
}
