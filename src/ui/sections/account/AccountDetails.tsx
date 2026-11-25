import { useReducedMotion } from "framer-motion";
import { ArrowRight, Check, X } from "lucide-react";
import { Link } from "react-router-dom";
import { catalogPathOf } from "@/domain/account-kind";
import type { ReactNode } from "react";
import type { Account } from "@/domain/account";
import { useFillTokens, useSiteContent } from "@/ui/hooks/useSiteContent";
import { FAQ_TOPIC_LABEL, faqAnchorOf } from "@/domain/site-content";
import { descriptionOf, includedOf, specsOf, statusItemsOf, statusTopicOf, type StatusItem, type StatusText } from "@/ui/lib/account-presenter";
import { openFaqAnchor, useAccountFaqItems } from "@/ui/sections/home/Faq";
import type { SiteContent } from "@/domain/site-content";
import { cn } from "@/ui/lib/cn";
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
        {descriptionOf(account, accountPage.descriptionTemplates).map((paragraph) => (
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

/** Texto do item, como o Jota escreveu na aba Site. */
function statusTextOf(accountPage: SiteContent["accountPage"], { section, field }: StatusText): string {
  switch (section) {
    case "tiktokStatus":
      return accountPage.tiktokStatus[field];
    case "instagramStatus":
      return accountPage.instagramStatus[field];
    case "youtubeStatus":
      return accountPage.youtubeStatus[field];
  }
}

/** Deixa claro, logo abaixo dos números, o que a conta tem: Shop (TikTok e Instagram) e monetização. */
export function AccountStatusBox({ account }: { account: Account }) {
  const { accountPage } = useSiteContent();
  const reduceMotion = useReducedMotion();
  const items = statusItemsOf(account);
  const anchors = new Set(useAccountFaqItems(account.platform).flatMap((item) => (item.anchorId ? [item.anchorId] : [])));
  /** A pergunta das Dúvidas que explica o item, quando a página tem uma. */
  const explainerOf = (item: StatusItem) => {
    const topic = statusTopicOf(account.platform, item);
    if (!topic || !anchors.has(faqAnchorOf(topic))) return null;
    return { anchorId: faqAnchorOf(topic), label: FAQ_TOPIC_LABEL[topic] };
  };
  if (items.length === 0) return null;
  const alternatives = items.flatMap((item) => (item.alternative ? [item.alternative] : []));
  return (
    <section aria-labelledby="status-conta-title" className="mt-6">
      <h2 id="status-conta-title" {...editable("accountPage.tiktokStatus.title")} className="text-sm font-semibold text-white">
        {accountPage.tiktokStatus.title}
      </h2>
      <div className="mt-3 rounded-2xl border border-line bg-surface/60">
        <ul className="divide-y divide-line px-4 sm:px-5">
          {items.map((item) => {
            const explainer = explainerOf(item);
            return (
              <li key={item.id} className="py-4">
                <p className="flex items-center gap-2.5 font-semibold text-white">
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-full",
                      item.has ? "bg-emerald-400/15 text-emerald-300" : "bg-white/10 text-fog",
                    )}
                  >
                    {item.has ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                  </span>
                  {item.label}
                </p>
                {/* O "Entenda" vai dentro do próprio texto, em azul: um toque e a pessoa cai na resposta das Dúvidas. */}
                <p className="mt-1.5 text-sm leading-relaxed text-mist">
                  <span {...editable(`accountPage.${item.text.section}.${item.text.field}`)}>{statusTextOf(accountPage, item.text)}</span>
                  {explainer && (
                    <>
                      {" "}
                      <a
                        href={`#${explainer.anchorId}`}
                        onClick={(event) => {
                          event.preventDefault();
                          openFaqAnchor(explainer.anchorId, !reduceMotion);
                        }}
                        className="font-semibold whitespace-nowrap text-electric-soft underline decoration-electric-soft/40 underline-offset-4 transition-colors hover:decoration-electric-soft"
                      >
                        Entenda o que é {explainer.label}
                      </a>
                    </>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
        {/* Quem queria outro tipo acha o recorte da vitrine aqui embaixo, sem um link no meio de cada item. */}
        {alternatives.length > 0 && (
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line px-4 py-3 text-sm sm:px-5">
            <span className="text-mist">Procurando outra?</span>
            {alternatives.map((alternative) => (
              <Link
                key={alternative.kind}
                to={catalogPathOf(alternative.kind)}
                className="inline-flex items-center gap-1 font-semibold text-electric-soft underline-offset-4 hover:underline"
              >
                {alternative.label}
                <ArrowRight aria-hidden className="size-3.5" />
              </Link>
            ))}
          </p>
        )}
      </div>
    </section>
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
