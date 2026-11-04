import { ArrowRight, Check, Store, Wallet } from "lucide-react";
import { whatsappMessageUrl } from "@/domain/store-settings";
import { buttonClasses } from "@/ui/components/Button";
import { Reveal, RevealItem } from "@/ui/components/Reveal";
import { WhatsAppGlyph } from "@/ui/components/whatsapp/WhatsAppGlyph";
import { useDocumentMeta } from "@/ui/hooks/useDocumentMeta";
import { useSiteContent } from "@/ui/hooks/useSiteContent";
import { useStoreSettings } from "@/ui/hooks/useStoreSettings";
import { editable } from "@/ui/lib/site-preview";

/** Ícone de cada passo, na ordem. Títulos e textos vêm do painel. */
const STEP_ICONS = [WhatsAppGlyph, Store, Wallet] as const;

/** Leva ao WhatsApp do Jota com a mensagem pronta; sem número salvo, ao Instagram da loja. */
function PartnerContactButton({ className }: { className?: string }) {
  const { partnerPage } = useSiteContent();
  const { whatsappUrl, instagramUrl } = useStoreSettings();
  const href = whatsappUrl ? whatsappMessageUrl(whatsappUrl, partnerPage.whatsappMessage) : instagramUrl;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={buttonClasses({ size: "lg", className })}>
      {whatsappUrl && <WhatsAppGlyph aria-hidden className="size-4" />}
      <span {...editable("partnerPage.button")}>{partnerPage.button}</span>
      <ArrowRight aria-hidden className="size-4" />
    </a>
  );
}

function PartnerSteps() {
  const { partnerPage } = useSiteContent();
  return (
    <Reveal as="ol" stagger className="mt-12 grid gap-3 sm:mt-16 sm:gap-5 md:grid-cols-3">
      {partnerPage.steps.map((step, index) => {
        const Icon = STEP_ICONS[index] ?? Store;
        return (
          <RevealItem as="li" key={index}>
            <div className="hover-pulse flex h-full gap-4 rounded-2xl border border-line bg-surface/70 p-4 sm:block sm:rounded-3xl sm:p-6">
              <div className="flex shrink-0 items-center justify-between">
                <span className="pulse-icon grid size-11 place-items-center rounded-xl border border-white/10 bg-ink text-electric sm:size-14 sm:rounded-2xl">
                  <Icon aria-hidden className="size-5 sm:size-6" />
                </span>
                <span className="font-display text-4xl font-bold text-white/[0.07] max-sm:hidden">0{index + 1}</span>
              </div>
              <div className="min-w-0">
                <h2 className="font-display text-base font-semibold text-white sm:mt-6 sm:text-lg">
                  <span aria-hidden className="mr-2 text-electric-soft/60 tabular-nums sm:hidden">
                    0{index + 1}
                  </span>
                  <span {...editable(`partnerPage.steps.${index}.title`)}>{step.title}</span>
                </h2>
                <p {...editable(`partnerPage.steps.${index}.text`)} className="mt-1 text-sm leading-relaxed text-mist sm:mt-2">
                  {step.text}
                </p>
              </div>
            </div>
          </RevealItem>
        );
      })}
    </Reveal>
  );
}

function PartnerPerks() {
  const { partnerPage } = useSiteContent();
  return (
    <Reveal className="mt-5 rounded-2xl border border-line bg-surface/70 p-5 sm:rounded-3xl sm:p-8">
      <h2 {...editable("partnerPage.perksTitle")} className="font-display text-lg font-semibold text-white sm:text-xl">
        {partnerPage.perksTitle}
      </h2>
      <ul className="mt-4 grid gap-3 sm:mt-6 sm:grid-cols-2">
        {partnerPage.perks.map((perk, index) => (
          <li key={index} className="flex gap-3 text-sm leading-relaxed text-fog sm:text-[0.95rem]">
            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-electric/15 text-electric">
              <Check aria-hidden className="size-3" />
            </span>
            <span {...editable(`partnerPage.perks.${index}`)}>{perk}</span>
          </li>
        ))}
      </ul>
    </Reveal>
  );
}

function PartnerCta() {
  const { partnerPage } = useSiteContent();
  return (
    <Reveal className="relative mt-14 overflow-hidden rounded-3xl bg-gradient-brand p-px sm:mt-20 sm:rounded-[2rem]">
      <div className="relative overflow-hidden rounded-[calc(1.5rem-1px)] bg-ink px-5 py-10 text-center sm:rounded-[calc(2rem-1px)] sm:px-6 sm:py-14 md:px-16">
        <div aria-hidden className="absolute inset-0 bg-grid opacity-60 [mask-image:radial-gradient(circle_at_center,black,transparent_70%)]" />
        <div aria-hidden className="absolute -top-32 left-1/2 h-64 w-[24rem] -translate-x-1/2 rounded-full bg-violet/40 blur-[80px] md:w-[36rem] md:blur-[120px]" />
        <div className="relative">
          <h2 {...editable("partnerPage.ctaTitle")} className="font-display text-section font-semibold tracking-tight text-balance text-white md:text-5xl">
            {partnerPage.ctaTitle}
          </h2>
          <p {...editable("partnerPage.ctaText")} className="mx-auto mt-3 max-w-xl text-[0.95rem] leading-relaxed text-pretty text-mist md:mt-5 md:text-lg">
            {partnerPage.ctaText}
          </p>
          <PartnerContactButton className="mt-7 w-full sm:mt-10 sm:w-auto" />
        </div>
      </div>
    </Reveal>
  );
}

export default function PartnerPage() {
  const { partnerPage } = useSiteContent();
  useDocumentMeta("Seja parceiro", partnerPage.description);

  return (
    <div className="pt-28 pb-14 sm:pb-20 md:pt-36 md:pb-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="max-w-3xl">
          <p {...editable("partnerPage.eyebrow")} className="font-display text-xs font-semibold tracking-[0.2em] text-electric uppercase">
            {partnerPage.eyebrow}
          </p>
          <h1
            id="parceiro-title"
            {...editable("partnerPage.title")}
            className="mt-4 font-display text-4xl font-semibold tracking-tight text-balance text-white md:text-6xl"
          >
            {partnerPage.title}
          </h1>
          <p {...editable("partnerPage.description")} className="mt-4 text-lg leading-relaxed text-pretty text-fog md:mt-6">
            {partnerPage.description}
          </p>
          <PartnerContactButton className="mt-7 w-full sm:mt-9 sm:w-auto" />
        </Reveal>

        <PartnerSteps />
        <PartnerPerks />
        <PartnerCta />
      </div>
    </div>
  );
}
