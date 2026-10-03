import { Check, X } from "lucide-react";
import { Reveal, RevealItem } from "@/ui/components/Reveal";
import { SectionHeading } from "@/ui/components/SectionHeading";
import { VerifiedBadge } from "@/ui/components/VerifiedBadge";

const FROM_SCRATCH = [
  "Meses postando para crescer a conta",
  "Pedido de acesso ao Shop sem garantia de aprovação",
  "Cerca de 60% das solicitações recusadas",
  "Recomeçar do zero a cada recusa",
] as const;

const WITH_JOTA = [
  "Conta ativa com seguidores reais e brasileiros",
  "Central de Criadores do TikTok Shop já liberada",
  "Sem documentos vinculados à conta",
  "Você troca nome, @ e foto e já pode vender",
] as const;

export function ProblemSection() {
  return (
    <section aria-labelledby="problema-title" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          id="problema-title"
          eyebrow="Por que comprar pronta"
          title={
            <>
              Criar do zero custa tempo. <span className="text-mist">E pode terminar em recusa.</span>
            </>
          }
          description="O TikTok recusa boa parte dos pedidos para entrar no Shop. Com a conta pronta, você pula direto para a parte que dá dinheiro."
        />

        <Reveal stagger className="mt-14 grid gap-5 md:grid-cols-2">
          <RevealItem className="rounded-3xl border border-line bg-surface/60 p-7 md:p-9">
            <p className="text-sm font-semibold text-mist">Criando sua própria conta</p>
            <div className="mt-6 rounded-2xl border border-alert/25 bg-alert/[0.06] p-4">
              <p className="text-sm font-semibold text-white">Sua solicitação de conta foi rejeitada.</p>
              <p className="mt-1 text-xs leading-relaxed text-mist">
                No momento, você não se qualifica para o acesso de criador do TikTok Shop.
              </p>
            </div>
            <ul className="mt-7 space-y-3.5">
              {FROM_SCRATCH.map((item) => (
                <li key={item} className="flex gap-3 text-sm text-fog">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-alert/15 text-alert">
                    <X aria-hidden className="size-3" strokeWidth={3} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </RevealItem>

          <RevealItem className="relative rounded-3xl bg-gradient-brand p-px">
            <div className="h-full rounded-[calc(1.5rem-1px)] bg-surface p-7 md:p-9">
              <p className="flex items-center gap-2 text-sm font-semibold text-white">
                <VerifiedBadge className="size-5" /> Com uma conta Jota Digitais
              </p>
              <div className="mt-6 rounded-2xl border border-electric/25 bg-electric/[0.07] p-4">
                <p className="text-sm font-semibold text-white">Bem-vindo à Central de Criadores do TikTok Shop</p>
                <p className="mt-1 text-xs leading-relaxed text-mist">
                  Publique seu primeiro vídeo com produtos à venda e comece a ganhar.
                </p>
              </div>
              <ul className="mt-7 space-y-3.5">
                {WITH_JOTA.map((item) => (
                  <li key={item} className="flex gap-3 text-sm text-fog">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-electric/15 text-electric">
                      <Check aria-hidden className="size-3" strokeWidth={3} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </RevealItem>
        </Reveal>
      </div>
    </section>
  );
}
