import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { formatCount, isNewListing, isPurchasable, type Account } from "@/domain/account";
import { formatBRL } from "@/domain/money";
import { MAX_CARD_INSTALLMENTS } from "@/domain/order";
import { accountBadge, audienceLabel, cardMetric, verifiedLabel } from "@/ui/lib/account-presenter";
import { cn } from "@/ui/lib/cn";
import { PlatformGlyph } from "../PlatformGlyph";
import { VerifiedBadge } from "../VerifiedBadge";
import { AccountAvatar, gradientFor } from "./AccountAvatar";
import { AccountBadgePill, PlatformTag, StatusBadge } from "./AccountBadges";

function CardCover({ account }: { account: Account }) {
  const available = isPurchasable(account);
  return (
    <div aria-hidden className="relative h-[4.5rem] overflow-hidden sm:h-24">
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-35 transition-opacity duration-500 group-hover:opacity-60",
          gradientFor(account.id),
        )}
      />
      <div className="absolute inset-0 bg-grid opacity-60" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-surface" />
      <PlatformGlyph
        platform={account.platform}
        className="absolute -right-3 -bottom-6 size-20 text-white/[0.06] transition-transform duration-500 group-hover:-rotate-6 sm:size-28"
      />
      <div className="absolute top-3 right-3 left-3 flex items-center justify-between sm:top-4 sm:right-4 sm:left-4">
        <PlatformTag platform={account.platform} />
        {available && isNewListing(account) ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[0.7rem] font-semibold text-ink">
            <span className="relative flex size-1.5">
              <span className="absolute inset-0 animate-ping rounded-full bg-pink" />
              <span className="relative size-1.5 rounded-full bg-pink" />
            </span>
            Nova
          </span>
        ) : (
          <StatusBadge status={account.status} />
        )}
      </div>
    </div>
  );
}

export function AccountCard({ account }: { account: Account }) {
  const available = isPurchasable(account);
  const badge = accountBadge(account);
  const metric = cardMetric(account);
  return (
    <article
      className={cn(
        "group relative h-full rounded-3xl bg-line p-px transition-[background,transform,box-shadow] duration-300",
        available &&
          "hover:-translate-y-1 hover:bg-gradient-brand hover:shadow-[0_30px_80px_-30px_rgb(39_153_255/0.45)]",
      )}
    >
      <div
        className={cn(
          "relative flex h-full flex-col overflow-hidden rounded-[calc(1.5rem-1px)] bg-surface",
          !available && "opacity-60",
        )}
      >
        <CardCover account={account} />

        <div className="relative flex flex-1 flex-col px-4 pb-4 sm:px-6 sm:pb-6">
          <div className="-mt-7 flex items-end gap-3 sm:-mt-9">
            <AccountAvatar account={account} className="size-14 text-sm ring-4 ring-surface sm:size-16 sm:text-base" />
            <div className="min-w-0 pb-1">
              <h3 className="flex items-center gap-1.5 font-display font-semibold text-white">
                <Link
                  to={`/contas/${account.slug}`}
                  className="truncate after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
                >
                  {account.displayName}
                </Link>
                {available && <VerifiedBadge className="size-4" label={verifiedLabel(account)} />}
              </h3>
              <p className="truncate text-sm text-mist">{account.handle}</p>
            </div>
          </div>

          {/* No mobile o selo sobe para esta linha e o card perde uma faixa inteira de altura. */}
          <div className="mt-4 flex items-end justify-between gap-4 sm:mt-6">
            <dl>
              <dt className="text-[0.7rem] text-mist">{audienceLabel(account)}</dt>
              <dd className="font-display text-2xl font-bold tracking-tight text-white tabular-nums sm:text-3xl">
                {formatCount(account.followers)}
              </dd>
            </dl>
            <div className="flex flex-col items-end gap-2 text-right">
              <AccountBadgePill badge={badge} className="sm:hidden" />
              <p className="flex items-center gap-1.5 text-sm font-medium text-fog tabular-nums">
                <metric.icon aria-hidden className="size-3.5 text-pink" />
                {metric.text}
              </p>
            </div>
          </div>

          <div className="mt-4 max-sm:hidden">
            <AccountBadgePill badge={badge} />
          </div>

          <div className="mt-4 flex items-end justify-between gap-3 border-t border-line pt-4 sm:mt-6 sm:pt-5">
            <div>
              <p className="font-display text-xl font-bold tracking-tight text-white tabular-nums sm:text-2xl">
                {formatBRL(account.price)}
              </p>
              <p className="text-xs text-mist">Pix ou até {MAX_CARD_INSTALLMENTS}x no cartão</p>
            </div>
            <span
              aria-hidden
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line-strong px-3.5 py-2 text-[0.82rem] font-semibold text-white transition-colors duration-300 sm:px-4 sm:text-sm",
                available && "group-hover:border-electric group-hover:bg-electric group-hover:text-ink",
              )}
            >
              {available ? "Ver conta" : "Indisponível"}
              {available && (
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
              )}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

export function AccountCardSkeleton() {
  return (
    <div aria-hidden className="overflow-hidden rounded-3xl border border-line bg-surface">
      <div className="h-[4.5rem] animate-pulse bg-white/[0.04] sm:h-24" />
      <div className="px-4 pb-4 sm:px-6 sm:pb-6">
        <div className="-mt-7 flex items-end gap-3 sm:-mt-9">
          <div className="size-14 animate-pulse rounded-full bg-white/[0.08] ring-4 ring-surface sm:size-16" />
          <div className="flex-1 space-y-2 pb-1">
            <div className="h-3.5 w-2/3 animate-pulse rounded bg-white/[0.07]" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-white/[0.05]" />
          </div>
        </div>
        <div className="mt-4 h-8 w-1/3 animate-pulse rounded bg-white/[0.07] sm:mt-6 sm:h-9" />
        <div className="mt-3 h-6 w-28 animate-pulse rounded-full bg-white/[0.05] sm:mt-4" />
        <div className="mt-4 h-12 animate-pulse rounded border-t border-line bg-white/[0.04] sm:mt-6" />
      </div>
    </div>
  );
}
