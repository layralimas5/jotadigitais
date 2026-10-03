import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Check, Mail, ShieldCheck, Wallet } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { siteConfig } from "@/app/config";
import {
  FULL_SHOP_MIN_FOLLOWERS,
  formatCount,
  isPurchasable,
  shopTierOf,
  type TikTokAccount,
} from "@/domain/account";
import { AccountNotFoundError } from "@/domain/errors";
import { formatBRL } from "@/domain/money";
import { MAX_CARD_INSTALLMENTS } from "@/domain/order";
import { ButtonLink } from "@/ui/components/Button";
import { NicheTag, ShopTierBadge, StatusBadge } from "@/ui/components/account/AccountBadges";
import { PhoneProfile } from "@/ui/components/account/PhoneProfile";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { VerifiedBadge } from "@/ui/components/VerifiedBadge";
import { useDocumentMeta } from "@/ui/hooks/useDocumentMeta";
import { useAccount } from "@/ui/hooks/useStore";
import { EASE_OUT_EXPO } from "@/ui/lib/motion";

const INCLUDED = [
  "Central de Criadores do TikTok Shop ativa",
  "Seguidores reais e brasileiros",
  "Sem documentos vinculados",
  "Troca livre de nome, @ e foto",
  "Login e senha entregues por e-mail",
] as const;

function tierExplanation(account: TikTokAccount): string {
  return shopTierOf(account) === "full"
    ? "Conta com Shop completo: todos os produtos disponíveis para afiliação."
    : `Shop em modo piloto (contas com menos de ${formatCount(FULL_SHOP_MIN_FOLLOWERS)} seguidores). Funciona normalmente; alguns produtos liberam conforme a conta cresce.`;
}

function PurchaseCta({ account }: { account: TikTokAccount }) {
  if (isPurchasable(account)) {
    return (
      <ButtonLink to={`/checkout/${account.slug}`} size="lg" className="w-full">
        Comprar esta conta
      </ButtonLink>
    );
  }
  return (
    <div className="space-y-3">
      <p className="rounded-2xl border border-line bg-white/[0.03] p-4 text-center text-sm text-fog">
        {account.status === "reserved"
          ? "Esta conta está reservada por outro cliente."
          : "Esta conta já foi vendida."}
      </p>
      <ButtonLink to="/contas" variant="secondary" size="lg" className="w-full">
        Ver outras contas
      </ButtonLink>
    </div>
  );
}

function AccountDetail({ account }: { account: TikTokAccount }) {
  const reduceMotion = useReducedMotion();
  useDocumentMeta(
    `${account.displayName} (${account.handle})`,
    `Conta de TikTok de ${account.niche} com ${formatCount(account.followers)} seguidores e TikTok Shop liberado por ${formatBRL(account.price)}.`,
  );

  const stats = [
    { label: "Seguidores", value: formatCount(account.followers) },
    { label: "Curtidas", value: formatCount(account.likes) },
    { label: "Seguindo", value: formatCount(account.following) },
  ];

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE_OUT_EXPO }}
        className="relative flex justify-center rounded-[2rem] border border-line bg-surface/60 py-12 lg:sticky lg:top-24 lg:self-start"
      >
        <div aria-hidden className="absolute inset-0 overflow-hidden rounded-[2rem]">
          <div className="absolute top-10 left-1/2 size-72 -translate-x-1/2 rounded-full bg-electric/20 blur-[100px]" />
          <div className="absolute bottom-0 left-10 size-48 rounded-full bg-pink/15 blur-[90px]" />
        </div>
        <PhoneProfile account={account} className="relative" />
      </motion.div>

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.08, ease: EASE_OUT_EXPO }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <ShopTierBadge tier={shopTierOf(account)} />
          <NicheTag niche={account.niche} />
          <StatusBadge status={account.status} />
        </div>

        <h1 className="mt-5 flex items-center gap-2 font-display text-4xl font-semibold tracking-tight text-white md:text-5xl">
          {account.displayName}
          <VerifiedBadge className="size-7" label="Shop liberado" />
        </h1>
        <p className="mt-2 text-lg text-mist">{account.handle}</p>

        <dl className="mt-8 grid grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-surface/60">
          {stats.map((stat) => (
            <div key={stat.label} className="px-4 py-5 text-center">
              <dt className="text-xs text-mist">{stat.label}</dt>
              <dd className="mt-1 font-display text-2xl font-semibold text-white tabular-nums">{stat.value}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-5 text-sm leading-relaxed text-mist">{tierExplanation(account)}</p>

        <div className="mt-8 rounded-3xl border border-line bg-surface p-6 md:p-7">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm text-mist">Valor da conta</p>
              <p className="mt-1 font-display text-4xl font-bold tracking-tight text-white tabular-nums">
                {formatBRL(account.price)}
              </p>
            </div>
            <p className="text-right text-xs text-mist">
              no Pix ou em até
              <br />
              {MAX_CARD_INSTALLMENTS}x no cartão
            </p>
          </div>
          <div className="mt-6">
            <PurchaseCta account={account} />
          </div>
          <ul className="mt-6 grid gap-2.5 text-xs text-fog sm:grid-cols-3">
            <li className="flex items-center gap-2">
              <Wallet aria-hidden className="size-4 text-electric" /> Pix ou cartão
            </li>
            <li className="flex items-center gap-2">
              <Mail aria-hidden className="size-4 text-electric" /> Entrega por e-mail
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck aria-hidden className="size-4 text-electric" /> {siteConfig.guaranteeDays} dias de garantia
            </li>
          </ul>
        </div>

        <h2 className="mt-10 font-display text-lg font-semibold text-white">O que está incluso</h2>
        <ul className="mt-4 space-y-3">
          {INCLUDED.map((item) => (
            <li key={item} className="flex items-center gap-3 text-sm text-fog">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-electric/15 text-electric">
                <Check aria-hidden className="size-3" strokeWidth={3} />
              </span>
              {item}
            </li>
          ))}
        </ul>
      </motion.div>
    </div>
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
        <div className="h-52 animate-pulse rounded-3xl bg-white/[0.05]" />
      </div>
    </div>
  );
}

export default function AccountPage() {
  const { slug = "" } = useParams();
  const account = useAccount(slug);

  return (
    <div className="relative pt-24 pb-24 md:pt-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <nav aria-label="Navegação estrutural" className="mb-8">
          <Link to="/contas" className="inline-flex items-center gap-2 text-sm text-mist transition-colors hover:text-white">
            <ArrowLeft aria-hidden className="size-4" /> Todas as contas
          </Link>
        </nav>
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
