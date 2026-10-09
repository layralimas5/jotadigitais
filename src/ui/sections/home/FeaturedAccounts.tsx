import { ArrowRight, ShieldCheck } from "lucide-react";
import { ButtonLink } from "@/ui/components/Button";
import { AccountCard, AccountCardSkeleton } from "@/ui/components/account/AccountCard";
import { Reveal, RevealItem } from "@/ui/components/Reveal";
import { SectionHeading } from "@/ui/components/SectionHeading";
import { ErrorState } from "@/ui/components/StateViews";
import { VerifiedBadge } from "@/ui/components/VerifiedBadge";
import { useAccounts } from "@/ui/hooks/useStore";

const FEATURED_COUNT = 6;
const MOBILE_COUNT = 3;

function StockStrip({ count }: { count: number }) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-5 text-[0.82rem] text-fog sm:mt-8 sm:gap-x-6 sm:gap-y-3 sm:pt-6 sm:text-sm">
      <p className="flex items-center gap-2.5">
        <span aria-hidden className="relative flex size-2">
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70" />
          <span className="relative size-2 rounded-full bg-emerald-400" />
        </span>
        <span>
          <strong className="font-semibold text-white tabular-nums">{count}</strong>{" "}
          {count === 1 ? "conta disponível" : "contas disponíveis"} agora
        </span>
      </p>
      <p className="flex items-center gap-2">
        <VerifiedBadge className="size-4" /> Conferidas uma a uma antes de entrar
      </p>
      <p className="flex items-center gap-2">
        <ShieldCheck aria-hidden className="size-4 text-electric" /> Entrega com garantia
      </p>
    </div>
  );
}

export function FeaturedAccounts() {
  const accounts = useAccounts({ onlyAvailable: true, sort: "recent" });

  return (
    <section aria-labelledby="destaques-title" className="relative border-y border-line bg-night py-14 sm:py-20 md:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col gap-5 sm:gap-8 md:flex-row md:items-end md:justify-between">
          <SectionHeading
            id="destaques-title"
            eyebrow="Disponíveis agora"
            title="Contas prontas para vender"
            description="Cada conta é única. Quando alguém compra, ela sai da vitrine."
          />
          <ButtonLink to="/contas" variant="secondary" className="hidden self-start sm:inline-flex md:self-auto">
            Ver todas <ArrowRight className="size-4" />
          </ButtonLink>
        </div>

        {accounts.status === "success" && <StockStrip count={accounts.data.length} />}

        <div className="mt-6 sm:mt-12">
          {accounts.status === "loading" && (
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3" aria-busy="true">
              {Array.from({ length: 3 }, (_, index) => (
                <AccountCardSkeleton key={index} />
              ))}
            </div>
          )}
          {accounts.status === "error" && <ErrorState message={accounts.error.message} onRetry={accounts.retry} />}
          {accounts.status === "success" && (
            <Reveal as="ul" stagger className="grid gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
              {accounts.data.slice(0, FEATURED_COUNT).map((account, index) => (
                <RevealItem as="li" key={account.id} className={index >= MOBILE_COUNT ? "hidden sm:block" : undefined}>
                  <AccountCard account={account} />
                </RevealItem>
              ))}
            </Reveal>
          )}
          {accounts.status === "success" && accounts.data.length > MOBILE_COUNT && (
            <ButtonLink to="/contas" variant="secondary" className="mt-4 w-full justify-center sm:hidden">
              Ver as {accounts.data.length} contas <ArrowRight className="size-4" />
            </ButtonLink>
          )}
        </div>
      </div>
    </section>
  );
}
