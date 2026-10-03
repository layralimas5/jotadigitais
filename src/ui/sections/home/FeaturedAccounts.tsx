import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/ui/components/Button";
import { AccountCard, AccountCardSkeleton } from "@/ui/components/account/AccountCard";
import { Reveal, RevealItem } from "@/ui/components/Reveal";
import { SectionHeading } from "@/ui/components/SectionHeading";
import { ErrorState } from "@/ui/components/StateViews";
import { useAccounts } from "@/ui/hooks/useStore";

const FEATURED_COUNT = 6;

export function FeaturedAccounts() {
  const accounts = useAccounts({ onlyAvailable: true, sort: "recent" });

  return (
    <section aria-labelledby="destaques-title" className="relative border-y border-line bg-night py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <SectionHeading
            id="destaques-title"
            eyebrow="Disponíveis agora"
            title="Contas prontas para vender"
            description="Cada conta é única. Quando alguém compra, ela sai da vitrine."
          />
          <ButtonLink to="/contas" variant="secondary" className="self-start md:self-auto">
            Ver todas <ArrowRight className="size-4" />
          </ButtonLink>
        </div>

        <div className="mt-12">
          {accounts.status === "loading" && (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
              {Array.from({ length: 3 }, (_, index) => (
                <AccountCardSkeleton key={index} />
              ))}
            </div>
          )}
          {accounts.status === "error" && <ErrorState message={accounts.error.message} onRetry={accounts.retry} />}
          {accounts.status === "success" && (
            <Reveal as="ul" stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {accounts.data.slice(0, FEATURED_COUNT).map((account) => (
                <RevealItem as="li" key={account.id}>
                  <AccountCard account={account} />
                </RevealItem>
              ))}
            </Reveal>
          )}
        </div>
      </div>
    </section>
  );
}
