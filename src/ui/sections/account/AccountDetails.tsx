import { Check } from "lucide-react";
import type { ReactNode } from "react";
import type { Account } from "@/domain/account";
import { useFillTokens, useSiteContent } from "@/ui/hooks/useSiteContent";
import { descriptionOf, includedOf, specsOf } from "@/ui/lib/account-presenter";
import { editable } from "@/ui/lib/site-preview";
import { STEP_ICONS, useSteps } from "@/ui/sections/home/HowItWorks";

function DetailBlock({ id, title, titlePath, children }: { id: string; title: string; titlePath: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} {...editable(titlePath)} className="font-display text-xl font-semibold text-white md:text-2xl">
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function AccountDescription({ account }: { account: Account }) {
  const { accountPage } = useSiteContent();
  return (
    <DetailBlock id="sobre-title" title={accountPage.aboutTitle} titlePath="accountPage.aboutTitle">
      <div className="space-y-4 text-base leading-relaxed whitespace-pre-line text-fog">
        {descriptionOf(account).map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        {account.niche && accountPage.nicheNote && (
          <p {...editable("accountPage.nicheNote")} className="text-mist">
            {accountPage.nicheNote}
          </p>
        )}
      </div>
    </DetailBlock>
  );
}

export function AccountSpecs({ account }: { account: Account }) {
  const { accountPage } = useSiteContent();
  return (
    <DetailBlock id="ficha-title" title={accountPage.specsTitle} titlePath="accountPage.specsTitle">
      <dl className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface/60">
        {specsOf(account, accountPage.fixedSpecs).map(({ label, value }) => (
          <div key={label} className="grid gap-1 px-5 py-3.5 sm:grid-cols-[13rem_1fr] sm:gap-4">
            <dt className="text-sm text-mist">{label}</dt>
            <dd className="text-sm font-medium text-white tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </DetailBlock>
  );
}

export function AccountIncluded({ account }: { account: Account }) {
  const { accountPage } = useSiteContent();
  const fill = useFillTokens();
  return (
    <DetailBlock id="incluso-title" title={accountPage.includedTitle} titlePath="accountPage.includedTitle">
      <ul {...editable(`accountPage.included.${account.platform}`)} className="space-y-3">
        {includedOf(account, accountPage.included).map((item) => (
          <li key={item} className="flex items-center gap-3 text-sm text-fog">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-electric/15 text-electric">
              <Check aria-hidden className="size-3" strokeWidth={3} />
            </span>
            {fill(item)}
          </li>
        ))}
      </ul>
    </DetailBlock>
  );
}

/** Os passos próprios da página de conta, ou os mesmos de Como funciona quando não há passos próprios. */
function useDeliverySteps() {
  const { accountPage } = useSiteContent();
  const homeSteps = useSteps();
  if (!accountPage.deliverySteps) return homeSteps.map((step, index) => ({ ...step, path: `howItWorks.steps.${index}` }));
  return accountPage.deliverySteps.map((step, index) => ({
    ...step,
    icon: homeSteps[index]?.icon ?? STEP_ICONS[0],
    path: `accountPage.deliverySteps.${index}`,
  }));
}

export function AccountDelivery() {
  const { accountPage } = useSiteContent();
  const steps = useDeliverySteps();
  return (
    <DetailBlock id="entrega-title" title={accountPage.deliveryTitle} titlePath="accountPage.deliveryTitle">
      <ol className="space-y-5">
        {steps.map(({ icon: Icon, title, text, path }, index) => (
          <li key={index} className="relative flex gap-4">
            {index < steps.length - 1 && (
              <span aria-hidden className="absolute top-11 bottom-[-1.25rem] left-[1.15rem] w-px bg-line" />
            )}
            <span className="relative grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-ink text-electric">
              <Icon aria-hidden className="size-4" />
            </span>
            <div className="pt-1">
              <p className="text-sm font-semibold text-white">
                <span className="text-mist">0{index + 1}.</span> <span {...editable(`${path}.title`)}>{title}</span>
              </p>
              <p {...editable(`${path}.text`)} className="mt-1 text-sm leading-relaxed text-mist">
                {text}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </DetailBlock>
  );
}
