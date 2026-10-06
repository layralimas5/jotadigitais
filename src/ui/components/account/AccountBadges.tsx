import type { AccountStatus, ShopTier } from "@/domain/account";
import { cn } from "@/ui/lib/cn";

const tierCopy: Record<ShopTier, { label: string; className: string }> = {
  full: { label: "TikTok Shop ativo", className: "border-electric/40 bg-electric/10 text-electric-soft" },
  pilot: { label: "Shop piloto", className: "border-pink/35 bg-pink/10 text-pink" },
};

export function ShopTierBadge({ tier, className }: { tier: ShopTier; className?: string }) {
  const { label, className: tone } = tierCopy[tier];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold tracking-wide",
        tone,
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {label}
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

export function NicheTag({ niche }: { niche: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-white/[0.06] px-2.5 py-1 text-[0.7rem] font-medium text-fog">
      {niche}
    </span>
  );
}
