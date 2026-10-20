import { BadgeCheck, KeyRound, LifeBuoy, ShieldCheck } from "lucide-react";
import { Reveal, RevealItem } from "@/ui/components/Reveal";
import { SectionHeading } from "@/ui/components/SectionHeading";
import { useFillTokens, useSiteContent } from "@/ui/hooks/useSiteContent";
import { editable } from "@/ui/lib/site-preview";

/** Ícone de cada card, na ordem. Títulos e textos vêm do painel. */
const ITEM_ICONS = [ShieldCheck, KeyRound, BadgeCheck, LifeBuoy] as const;

export function Guarantee() {
  const { guarantee } = useSiteContent();
  const fill = useFillTokens();
  return (
    <section id="garantia" aria-labelledby="garantia-title" className="relative py-14 sm:py-20 md:py-32">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:gap-14 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <SectionHeading
          id="garantia-title"
          editPrefix="guarantee"
          eyebrow={fill(guarantee.eyebrow)}
          title={fill(guarantee.title)}
          description={fill(guarantee.description)}
        />
        <Reveal stagger className="grid gap-3 sm:grid-cols-2 sm:gap-4">
          {guarantee.items.map(({ title, text }, index) => {
            const Icon = ITEM_ICONS[index] ?? ShieldCheck;
            return (
              <RevealItem key={index}>
                <div className="hover-pulse flex h-full gap-4 rounded-2xl border border-line bg-surface/70 p-4 sm:block sm:rounded-3xl sm:p-6">
                  <span className="pulse-icon inline-grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-ink text-electric sm:size-11">
                    <Icon aria-hidden className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <h3 {...editable(`guarantee.items.${index}.title`)} className="font-display font-semibold text-white sm:mt-5">
                      {fill(title)}
                    </h3>
                    <p {...editable(`guarantee.items.${index}.text`)} className="mt-1 text-sm leading-relaxed text-mist sm:mt-2">
                      {fill(text)}
                    </p>
                  </div>
                </div>
              </RevealItem>
            );
          })}
        </Reveal>
      </div>
    </section>
  );
}
