import { motion, useInView, useReducedMotion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { siteConfig } from "@/app/config";
import { formatCount, isPurchasable, type Account } from "@/domain/account";
import { AccountNotFoundError } from "@/domain/errors";
import { formatBRL } from "@/domain/money";
import { PLATFORM_LABEL } from "@/domain/platform";
import { ButtonLink } from "@/ui/components/Button";
import { AccountBadgePill, NicheTag, PlatformTag, StatusBadge } from "@/ui/components/account/AccountBadges";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { VerifiedBadge } from "@/ui/components/VerifiedBadge";
import { useDocumentMeta } from "@/ui/hooks/useDocumentMeta";
import { useAccount } from "@/ui/hooks/useStore";
import { accountBadge, audienceLabel, profileStats, verifiedLabel } from "@/ui/lib/account-presenter";
import { EASE_OUT_EXPO } from "@/ui/lib/motion";
import { AccountBuyBox } from "@/ui/sections/account/AccountBuyBox";
import {
  AccountDelivery,
  AccountDescription,
  AccountIncluded,
  AccountSpecs,
} from "@/ui/sections/account/AccountDetails";
import { AccountGallery } from "@/ui/sections/account/AccountGallery";
import { MobileBuyBar } from "@/ui/sections/account/MobileBuyBar";
import { RelatedAccounts } from "@/ui/sections/account/RelatedAccounts";
import { FAQ_ITEMS, FaqItem } from "@/ui/sections/home/Faq";

function Breadcrumb({ account }: { account?: Account }) {
  const crumbs = [
    { label: "Início", to: "/" },
    { label: "Contas", to: "/contas" },
    ...(account ? [{ label: PLATFORM_LABEL[account.platform], to: `/contas?rede=${account.platform}` }] : []),
  ];
  return (
    <nav aria-label="Navegação estrutural" className="mb-8">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-mist">
        {crumbs.map((crumb) => (
          <li key={crumb.to} className="flex items-center gap-1.5">
            <Link to={crumb.to} className="transition-colors hover:text-white">
              {crumb.label}
            </Link>
            <ChevronRight aria-hidden className="size-3.5" />
          </li>
        ))}
        {account && (
          <li aria-current="page" className="truncate text-fog">
            {account.displayName}
          </li>
        )}
      </ol>
    </nav>
  );
}

function ProductJsonLd({ account }: { account: Account }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `Conta de ${PLATFORM_LABEL[account.platform]} ${account.displayName}`,
    description: `Conta de ${PLATFORM_LABEL[account.platform]} com ${account.followers} ${audienceLabel(account).toLowerCase()}.`,
    sku: account.slug,
    category: account.niche ?? PLATFORM_LABEL[account.platform],
    brand: { "@type": "Brand", name: siteConfig.name },
    offers: {
      "@type": "Offer",
      url: `${siteConfig.url}/contas/${account.slug}`,
      priceCurrency: "BRL",
      price: (account.price / 100).toFixed(2),
      availability: isPurchasable(account) ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
      itemCondition: "https://schema.org/UsedCondition",
    },
  };
  return <script type="application/ld+json">{JSON.stringify(data)}</script>;
}

function AccountHeader({ account }: { account: Account }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <PlatformTag platform={account.platform} />
        <AccountBadgePill badge={accountBadge(account)} />
        {account.niche && <NicheTag niche={account.niche} />}
        <StatusBadge status={account.status} />
      </div>
      <h1 className="mt-5 flex items-center gap-2 font-display text-[clamp(2rem,1.4rem+3vw,3rem)] leading-tight font-semibold tracking-tight text-white">
        {account.displayName}
        <VerifiedBadge className="size-7" label={verifiedLabel(account)} />
      </h1>
      <p className="mt-2 text-lg text-mist">{account.handle}</p>

      <dl className="mt-8 grid grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-surface/60">
        {profileStats(account).map((stat) => (
          <div key={stat.label} className="px-2 py-4 text-center sm:px-4 sm:py-5">
            <dt className="text-xs text-mist">{stat.label}</dt>
            <dd className="mt-1 font-display text-xl font-semibold text-white tabular-nums sm:text-2xl">{stat.value}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

function AccountFaq({ account }: { account: Account }) {
  const items = FAQ_ITEMS.filter((item) => !("tiktokOnly" in item) || account.platform === "tiktok");
  return (
    <section aria-labelledby="faq-conta-title">
      <h2 id="faq-conta-title" className="font-display text-xl font-semibold text-white md:text-2xl">
        Dúvidas sobre a compra
      </h2>
      <div className="mt-2 border-t border-line">
        {items.map((item) => (
          <FaqItem key={item.question} question={item.question} answer={item.answer} />
        ))}
      </div>
    </section>
  );
}

function AccountDetail({ account }: { account: Account }) {
  const reduceMotion = useReducedMotion();
  const ctaRef = useRef<HTMLDivElement>(null);
  const ctaInView = useInView(ctaRef);
  useDocumentMeta(
    `${account.displayName} (${account.handle})`,
    `Conta de ${PLATFORM_LABEL[account.platform]} com ${formatCount(account.followers)} ${audienceLabel(account).toLowerCase()} por ${formatBRL(account.price)}.`,
  );

  const enter = (delay: number) => ({
    initial: reduceMotion ? false : { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay, ease: EASE_OUT_EXPO },
  });

  return (
    <>
      <ProductJsonLd account={account} />
      <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        <motion.div {...enter(0)}>
          <AccountGallery account={account} />
        </motion.div>
        <motion.div {...enter(0.08)}>
          <AccountHeader account={account} />
          <div className="mt-8">
            <AccountBuyBox account={account} ctaRef={ctaRef} />
          </div>
        </motion.div>
      </div>

      <div className="mt-20 grid gap-14 border-t border-line pt-16 lg:grid-cols-[1.2fr_0.8fr] lg:gap-16">
        <div className="space-y-14">
          <AccountDescription account={account} />
          <AccountSpecs account={account} />
        </div>
        <div className="space-y-14">
          <AccountIncluded account={account} />
          <AccountDelivery />
        </div>
      </div>

      <div className="mt-20 border-t border-line pt-16">
        <AccountFaq account={account} />
      </div>

      <div className="mt-20 border-t border-line pt-16">
        <RelatedAccounts account={account} />
      </div>

      <MobileBuyBar account={account} visible={isPurchasable(account) && !ctaInView} />
    </>
  );
}

function DetailSkeleton() {
  return (
    <div aria-busy="true" className="grid gap-12 lg:grid-cols-[1fr_1.1fr]">
      <div className="h-[36rem] animate-pulse rounded-[2rem] bg-white/[0.04]" />
      <div className="space-y-5">
        <div className="h-6 w-40 animate-pulse rounded-full bg-white/[0.06]" />
        <div className="h-12 w-3/4 animate-pulse rounded-xl bg-white/[0.07]" />
        <div className="h-24 animate-pulse rounded-2xl bg-white/[0.05]" />
        <div className="h-72 animate-pulse rounded-3xl bg-white/[0.05]" />
      </div>
    </div>
  );
}

export default function AccountPage() {
  const { slug = "" } = useParams();
  const account = useAccount(slug);

  return (
    <div className="relative pt-24 pb-28 md:pt-32 lg:pb-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Breadcrumb account={account.status === "success" ? account.data : undefined} />
        {account.status === "loading" && <DetailSkeleton />}
        {account.status === "error" &&
          (account.error instanceof AccountNotFoundError ? (
            <EmptyState
              title="Conta não encontrada"
              description="Ela pode ter sido vendida ou o link está incorreto."
              action={<ButtonLink to="/contas">Ver contas disponíveis</ButtonLink>}
            />
          ) : (
            <ErrorState message={account.error.message} onRetry={account.retry} />
          ))}
        {account.status === "success" && <AccountDetail account={account.data} />}
      </div>
    </div>
  );
}
