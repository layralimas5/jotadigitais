import { ArrowRight, Heart } from "lucide-react";
import { Link } from "react-router-dom";
import {
  followersToFullShop,
  formatCount,
  fullShopProgress,
  isNewListing,
  isPurchasable,
  shopTierOf,
  type TikTokAccount,
} from "@/domain/account";
import { formatBRL } from "@/domain/money";
import { MAX_CARD_INSTALLMENTS } from "@/domain/order";
import { cn } from "@/ui/lib/cn";
import { TikTokGlyph } from "../TikTokGlyph";
import { VerifiedBadge } from "../VerifiedBadge";
import { AccountAvatar, gradientFor } from "./AccountAvatar";
import { NicheTag, ShopTierBadge, StatusBadge } from "./AccountBadges";

function CardCover({ account }: { account: TikTokAccount }) {
  const available = isPurchasable(account);
  return (
    <div aria-hidden className="relative h-24 overflow-hidden">
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-35 transition-opacity duration-500 group-hover:opacity-60",
          gradientFor(account.id),
        )}
      />
      <div className="absolute inset-0 bg-grid opacity-60" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-surface" />
      <TikTokGlyph className="absolute -right-3 -bottom-6 size-28 text-white/[0.06] transition-transform duration-500 group-hover:-rotate-6" />
      <div className="absolute top-4 right-4 left-4 flex items-center justify-between">
        <NicheTag niche={account.niche} />
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

function ShopProgress({ account }: { account: TikTokAccount }) {
  const tier = shopTierOf(account);
  const missing = followersToFullShop(account);
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <ShopTierBadge tier={tier} />
        <span className="text-[0.7rem] text-mist">
          {tier === "full" ? "Todos os produtos liberados" : `Faltam ${formatCount(missing)} p/ o completo`}
        </span>
      </div>
      <div
        className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"
        role="progressbar"
        aria-label="Progresso até o Shop completo"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fullShopProgress(account) * 100)}
      >
        <div
          className={cn("h-full rounded-full", tier === "full" ? "bg-electric" : "bg-gradient-brand")}
          style={{ width: `${fullShopProgress(account) * 100}%` }}
        />
      </div>
    </div>
  );
}

export function AccountCard({ account }: { account: TikTokAccount }) {
  const available = isPurchasable(account);
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

        <div className="relative flex flex-1 flex-col px-5 pb-5 sm:px-6 sm:pb-6">
          <div className="-mt-9 flex items-end gap-3">
            <AccountAvatar account={account} className="size-16 text-base ring-4 ring-surface" />
            <div className="min-w-0 pb-1">
              <h3 className="flex items-center gap-1.5 font-display font-semibold text-white">
                <Link
                  to={`/contas/${account.slug}`}
                  className="truncate after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
                >
                  {account.displayName}
                </Link>
                {available && <VerifiedBadge className="size-4" label="Central de Criadores ativa" />}
              </h3>
              <p className="truncate text-sm text-mist">{account.handle}</p>
            </div>
          </div>

          <dl className="mt-6 flex items-end justify-between gap-4">
            <div>
              <dt className="text-[0.7rem] text-mist">Seguidores</dt>
              <dd className="font-display text-3xl font-bold tracking-tight text-white tabular-nums">
                {formatCount(account.followers)}
              </dd>
            </div>
            <div className="text-right">
              <dt className="sr-only">Curtidas</dt>
              <dd className="flex items-center gap-1.5 text-sm font-medium text-fog tabular-nums">
                <Heart aria-hidden className="size-3.5 text-pink" />
                {formatCount(account.likes)} curtidas
              </dd>
            </div>
          </dl>

          <div className="mt-4">
            <ShopProgress account={account} />
          </div>

          <div className="mt-6 flex items-end justify-between gap-3 border-t border-line pt-5">
            <div>
              <p className="font-display text-2xl font-bold tracking-tight text-white tabular-nums">
                {formatBRL(account.price)}
              </p>
              <p className="text-xs text-mist">Pix ou até {MAX_CARD_INSTALLMENTS}x no cartão</p>
            </div>
            <span
              aria-hidden
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border border-line-strong px-4 py-2 text-sm font-semibold text-white transition-colors duration-300",
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
      <div className="h-24 animate-pulse bg-white/[0.04]" />
      <div className="px-6 pb-6">
        <div className="-mt-9 flex items-end gap-3">
          <div className="size-16 animate-pulse rounded-full bg-white/[0.08] ring-4 ring-surface" />
          <div className="flex-1 space-y-2 pb-1">
            <div className="h-3.5 w-2/3 animate-pulse rounded bg-white/[0.07]" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-white/[0.05]" />
          </div>
        </div>
        <div className="mt-6 h-9 w-1/3 animate-pulse rounded bg-white/[0.07]" />
        <div className="mt-4 h-1.5 animate-pulse rounded-full bg-white/[0.05]" />
        <div className="mt-6 h-12 animate-pulse rounded border-t border-line bg-white/[0.04]" />
      </div>
    </div>
  );
}
