import { ArrowRight } from "lucide-react";
import type { Account } from "@/domain/account";
import { ButtonLink } from "@/ui/components/Button";
import { AccountCard } from "@/ui/components/account/AccountCard";
import { Reveal, RevealItem } from "@/ui/components/Reveal";
import { useSiteContent } from "@/ui/hooks/useSiteContent";
import { useAccounts } from "@/ui/hooks/useStore";
import { editable } from "@/ui/lib/site-preview";

const RELATED_COUNT = 3;

/** Mesma rede primeiro, depois as mais recentes. */
function pickRelated(current: Account, accounts: Account[]): Account[] {
  const others = accounts.filter((account) => account.id !== current.id);
  const samePlatform = others.filter((account) => account.platform === current.platform);
  const rest = others.filter((account) => account.platform !== current.platform);
  return [...samePlatform, ...rest].slice(0, RELATED_COUNT);
}

export function RelatedAccounts({ account }: { account: Account }) {
  const accounts = useAccounts({ onlyAvailable: true, sort: "recent" });
  const { accountPage } = useSiteContent();
  if (accounts.status !== "success") return null;

  const related = pickRelated(account, accounts.data);
  if (related.length === 0) return null;

  return (
    <section aria-labelledby="parecidas-title">
      <div className="flex items-end justify-between gap-4">
        <h2 id="parecidas-title" {...editable("accountPage.relatedTitle")} className="font-display text-xl font-semibold text-white md:text-2xl">
          {accountPage.relatedTitle}
        </h2>
        <ButtonLink to="/contas" variant="ghost" className="hidden sm:inline-flex">
          Ver todas <ArrowRight aria-hidden className="size-4" />
        </ButtonLink>
      </div>
      <Reveal as="ul" stagger className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {related.map((item) => (
          <RevealItem as="li" key={item.id}>
            <AccountCard account={item} />
          </RevealItem>
        ))}
      </Reveal>
    </section>
  );
}
