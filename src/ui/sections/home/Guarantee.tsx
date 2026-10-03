import { BadgeCheck, KeyRound, LifeBuoy, ShieldCheck } from "lucide-react";
import { siteConfig } from "@/app/config";
import { Reveal, RevealItem } from "@/ui/components/Reveal";
import { SectionHeading } from "@/ui/components/SectionHeading";

const ITEMS = [
  {
    icon: ShieldCheck,
    title: `${siteConfig.guaranteeDays} dias de garantia`,
    text: "Se a conta não tiver o Shop ativo na entrega, você recebe outra ou o dinheiro de volta.",
  },
  {
    icon: KeyRound,
    title: "Acesso completo",
    text: "Você recebe login e senha e passa a ser o único dono. Trocamos o e-mail da conta para o seu.",
  },
  {
    icon: BadgeCheck,
    title: "Conta conferida",
    text: "Cada conta é verificada antes de ir para a vitrine: Shop liberado e seguidores ativos.",
  },
  {
    icon: LifeBuoy,
    title: "Suporte na troca",
    text: "Ajudamos você a trocar nome, @, foto e a fazer a primeira afiliação.",
  },
] as const;

export function Guarantee() {
  return (
    <section id="garantia" aria-labelledby="garantia-title" className="relative py-24 md:py-32">
      <div className="mx-auto grid max-w-6xl gap-14 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <SectionHeading
          id="garantia-title"
          eyebrow="Garantia"
          title="Compra segura, do Pix ao primeiro vídeo"
          description="Você não fica sozinho depois do pagamento. A conta chega conferida e com suporte para começar."
        />
        <Reveal stagger className="grid gap-4 sm:grid-cols-2">
          {ITEMS.map(({ icon: Icon, title, text }) => (
            <RevealItem key={title}>
              <div className="hover-pulse h-full rounded-3xl border border-line bg-surface/70 p-6">
                <span className="pulse-icon inline-grid size-11 place-items-center rounded-xl border border-white/10 bg-ink text-electric">
                  <Icon aria-hidden className="size-5" />
                </span>
                <h3 className="mt-5 font-display font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-mist">{text}</p>
              </div>
            </RevealItem>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
