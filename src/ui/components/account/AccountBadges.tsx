import type { AccountStatus } from "@/domain/account";
import { PLATFORM_LABEL, type Platform } from "@/domain/platform";
import type { AccountBadge, BadgeTone } from "@/ui/lib/account-presenter";
import { cn } from "@/ui/lib/cn";
import { PlatformGlyph } from "../PlatformGlyph";

const toneClass: Record<BadgeTone, string> = {
  electric: "border-electric/40 bg-electric/10 text-electric-soft",
  pink: "border-pink/35 bg-pink/10 text-pink",
  emerald: "border-emerald-400/35 bg-emerald-400/10 text-emerald-300",
  mist: "border-white/15 bg-white/[0.05] text-fog",
};

export function AccountBadgePill({ badge, className }: { badge: AccountBadge; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold tracking-wide whitespace-nowrap",
        toneClass[badge.tone],
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {badge.label}
    </span>
  );
}

const statusCopy: Record<Exclude<AccountStatus, "available">, string> = {
  reserved: "Reservada",
  sold: "Vendida",
};

export function StatusBadge({ status }: { status: AccountStatus }) {
  if (status === "available") return null;
  return (
    <span className="inline-flex items-center rounded-full border border-white/15 bg-black/70 px-2.5 py-1 text-[0.7rem] font-semibold text-fog backdrop-blur">
      {statusCopy[status]}
    </span>
  );
}

export function PlatformTag({ platform, className }: { platform: Platform; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] px-2.5 py-1 text-[0.7rem] font-semibold text-white backdrop-blur",
        className,
      )}
    >
      <PlatformGlyph platform={platform} className="size-3.5" />
      {PLATFORM_LABEL[platform]}
    </span>
  );
}

export function NicheTag({ niche }: { niche: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-white/[0.06] px-2.5 py-1 text-[0.7rem] font-medium text-fog">
      {niche}
    </span>
  );
}
