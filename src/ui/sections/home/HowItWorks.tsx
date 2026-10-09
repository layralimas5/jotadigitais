import { CreditCard, MailCheck, MousePointerClick, Sparkles } from "lucide-react";
import { Reveal, RevealItem } from "@/ui/components/Reveal";
import { SectionHeading } from "@/ui/components/SectionHeading";

export const STEPS = [
  {
    icon: MousePointerClick,
    title: "Escolha a conta",
    text: "Veja seguidores, curtidas e o status do Shop de cada conta antes de decidir.",
  },
  {
    icon: CreditCard,
    title: "Pague no Pix ou no cartão",
    text: "À vista no Pix ou parcelado em até 12x. A conta fica reservada para você.",
  },
  {
    icon: MailCheck,
    title: "Receba o acesso por e-mail",
    text: "Com o pagamento confirmado, login e senha chegam no e-mail que você informou.",
  },
  {
    icon: Sparkles,
    title: "Deixe com a sua cara",
    text: "Troque nome, @ e foto, afilie produtos na vitrine e comece a ganhar comissão.",
  },
] as const;

export function HowItWorks() {
  return (
    <section id="como-funciona" aria-labelledby="como-funciona-title" className="relative py-14 sm:py-20 md:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          id="como-funciona-title"
          eyebrow="Como funciona"
          title="Da escolha à primeira venda em quatro passos"
          align="center"
        />

        <Reveal as="ol" stagger className="relative mt-8 grid gap-3 sm:mt-16 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
          <div
            aria-hidden
            className="absolute top-7 right-[12%] left-[12%] hidden h-px bg-gradient-to-r from-pink/0 via-electric/50 to-pink/0 lg:block"
          />
          {STEPS.map(({ icon: Icon, title, text }, index) => (
            <RevealItem as="li" key={title} className="relative">
              <div className="hover-pulse flex h-full gap-4 rounded-2xl border border-line bg-surface/70 p-4 sm:block sm:rounded-3xl sm:p-6">
                <div className="flex shrink-0 items-center justify-between">
                  <span className="pulse-icon grid size-11 place-items-center rounded-xl border border-white/10 bg-ink text-electric sm:size-14 sm:rounded-2xl">
                    <Icon aria-hidden className="size-5 sm:size-6" />
                  </span>
                  <span className="font-display text-4xl font-bold text-white/[0.07] max-sm:hidden">0{index + 1}</span>
                </div>
                <div className="min-w-0">
                  <h3 className="font-display text-base font-semibold text-white sm:mt-6 sm:text-lg">
                    <span aria-hidden className="mr-2 text-electric-soft/60 tabular-nums sm:hidden">
                      0{index + 1}
                    </span>
                    {title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-mist sm:mt-2">{text}</p>
                </div>
              </div>
            </RevealItem>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
