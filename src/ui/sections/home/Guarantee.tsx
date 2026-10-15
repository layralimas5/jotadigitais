import { BadgeCheck, KeyRound, LifeBuoy, ShieldCheck } from "lucide-react";
import { Reveal, RevealItem } from "@/ui/components/Reveal";
import { SectionHeading } from "@/ui/components/SectionHeading";
import { useStoreSettings } from "@/ui/hooks/useStoreSettings";

const itemsFor = (guaranteeDays: number) => [
  {
    icon: ShieldCheck,
    title: `${guaranteeDays} dias de garantia`,
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
];

export function Guarantee() {
  const { guaranteeDays } = useStoreSettings();
  return (
    <section id="garantia" aria-labelledby="garantia-title" className="relative py-14 sm:py-20 md:py-32">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:gap-14 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <SectionHeading
          id="garantia-title"
          eyebrow="Garantia"
          title="Compra segura, do Pix ao primeiro vídeo"
          description="Você não fica sozinho depois do pagamento. A conta chega conferida e com suporte para começar."
        />
        <Reveal stagger className="grid gap-3 sm:grid-cols-2 sm:gap-4">
          {itemsFor(guaranteeDays).map(({ icon: Icon, title, text }) => (
            <RevealItem key={title}>
              <div className="hover-pulse flex h-full gap-4 rounded-2xl border border-line bg-surface/70 p-4 sm:block sm:rounded-3xl sm:p-6">
                <span className="pulse-icon inline-grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-ink text-electric sm:size-11">
                  <Icon aria-hidden className="size-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-display font-semibold text-white sm:mt-5">{title}</h3>
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
