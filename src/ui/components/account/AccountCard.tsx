import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { formatCount, isPurchasable, shopTierOf, type TikTokAccount } from "@/domain/account";
import { formatBRL } from "@/domain/money";
import { MAX_CARD_INSTALLMENTS } from "@/domain/order";
import { cn } from "@/ui/lib/cn";
import { AccountAvatar } from "./AccountAvatar";
import { NicheTag, ShopTierBadge, StatusBadge } from "./AccountBadges";
import { VerifiedBadge } from "../VerifiedBadge";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.7rem] text-mist">{label}</dt>
      <dd className="mt-0.5 font-display text-lg font-semibold text-white tabular-nums">{value}</dd>
    </div>
  );
}

export function AccountCard({ account }: { account: TikTokAccount }) {
  const available = isPurchasable(account);
  return (
    <article
      className={cn(
        "group relative rounded-3xl bg-line p-px transition-colors duration-300",
        available && "hover:bg-gradient-brand",
      )}
    >
      <div
        className={cn(
          "relative flex h-full flex-col overflow-hidden rounded-[calc(1.5rem-1px)] bg-surface p-5 sm:p-6",
          !available && "opacity-60",
        )}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-16 size-56 rounded-full bg-electric/0 blur-3xl transition-colors duration-500 group-hover:bg-electric/15"
        />

        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <AccountAvatar account={account} />
            <div className="min-w-0">
              <h3 className="flex items-center gap-1.5 font-display font-semibold text-white">
                <Link
                  to={`/contas/${account.slug}`}
                  className="truncate after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
                >
                  {account.displayName}
                </Link>
              </h3>
              <p className="truncate text-sm text-mist">{account.handle}</p>
            </div>
          </div>
          <StatusBadge status={account.status} />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <ShopTierBadge tier={shopTierOf(account)} />
          <NicheTag niche={account.niche} />
        </div>

        <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-line pt-5">
          <Stat label="Seguidores" value={formatCount(account.followers)} />
          <Stat label="Curtidas" value={formatCount(account.likes)} />
          <Stat label="Seguindo" value={formatCount(account.following)} />
        </dl>

        <div className="mt-6 flex items-end justify-between gap-3 pt-1">
          <div>
            <p className="font-display text-2xl font-bold tracking-tight text-white tabular-nums">
              {formatBRL(account.price)}
            </p>
            <p className="text-xs text-mist">Pix ou até {MAX_CARD_INSTALLMENTS}x no cartão</p>
          </div>
          <span
            aria-hidden
            className={cn(
              "grid size-11 place-items-center rounded-full border border-line-strong text-white transition-all duration-300",
              available && "group-hover:border-electric group-hover:bg-electric group-hover:text-ink",
            )}
          >
            <ArrowUpRight className="size-5 transition-transform duration-300 group-hover:rotate-45" />
          </span>
        </div>

        {available && (
          <p className="mt-4 flex items-center gap-1.5 text-xs text-fog">
            <VerifiedBadge className="size-3.5" /> Central de Criadores ativa
          </p>
        )}
      </div>
    </article>
  );
}

export function AccountCardSkeleton() {
  return (
    <div aria-hidden className="rounded-3xl border border-line bg-surface p-6">
      <div className="flex items-center gap-3">
        <div className="size-12 animate-pulse rounded-full bg-white/[0.07]" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-2/3 animate-pulse rounded bg-white/[0.07]" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-white/[0.05]" />
        </div>
      </div>
      <div className="mt-6 h-6 w-1/2 animate-pulse rounded-full bg-white/[0.05]" />
      <div className="mt-6 grid grid-cols-3 gap-3 border-t border-line pt-5">
        {[0, 1, 2].map((key) => (
          <div key={key} className="h-9 animate-pulse rounded bg-white/[0.05]" />
        ))}
      </div>
      <div className="mt-7 h-8 w-1/3 animate-pulse rounded bg-white/[0.07]" />
    </div>
  );
}
