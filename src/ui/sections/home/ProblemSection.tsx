import { Check, X } from "lucide-react";
import { Reveal, RevealItem } from "@/ui/components/Reveal";
import { SectionHeading } from "@/ui/components/SectionHeading";
import { VerifiedBadge } from "@/ui/components/VerifiedBadge";
import { cn } from "@/ui/lib/cn";

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

type Tone = "alert" | "electric";

interface Screenshot {
  src: string;
  alt: string;
  width: number;
  height: number;
  tone: Tone;
  fadeClassName: string;
}

const REJECTED: Screenshot = {
  src: "/images/tiktok-shop-rejeitada.webp",
  alt: "Print do TikTok Shop: Sua solicitação de conta foi rejeitada. No momento, você não se qualifica para o acesso de criador do TikTok Shop.",
  width: 720,
  height: 560,
  tone: "alert",
  fadeClassName: "from-white",
};

const APPROVED: Screenshot = {
  src: "/images/tiktok-shop-central.webp",
  alt: "Print do TikTok Shop: Central de criadores do TikTok Shop, publique seu primeiro vídeo com produtos à venda.",
  width: 738,
  height: 880,
  tone: "electric",
  fadeClassName: "from-[#121212]",
};

/** Print real do app, recortado no topo com um esmaecido embaixo para parecer cortado. */
function ScreenshotCrop({ shot, className }: { shot: Screenshot; className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border shadow-2xl shadow-black/50",
        shot.tone === "alert" ? "border-alert/30" : "border-electric/30",
        className,
      )}
    >
      <img
        src={shot.src}
        alt={shot.alt}
        width={shot.width}
        height={shot.height}
        loading="lazy"
        decoding="async"
        className="size-full object-cover object-top"
      />
      <div
        aria-hidden
        className={cn("absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t md:h-16 to-transparent", shot.fadeClassName)}
      />
    </div>
  );
}

const toneIcon: Record<Tone, { icon: typeof X; className: string }> = {
  alert: { icon: X, className: "bg-alert/15 text-alert" },
  electric: { icon: Check, className: "bg-electric/15 text-electric" },
};

function ToneMark({ tone }: { tone: Tone }) {
  const { icon: Icon, className } = toneIcon[tone];
  return (
    <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full", className)}>
      <Icon aria-hidden className="size-3" strokeWidth={3} />
    </span>
  );
}

function ChecklistItems({ items, tone }: { items: readonly string[]; tone: Tone }) {
  return (
    <ul className="mt-4 space-y-2.5 md:mt-7 md:space-y-3.5">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-sm text-fog">
          <ToneMark tone={tone} />
          {item}
        </li>
      ))}
    </ul>
  );
}

/** Cada print fica dentro do card que ele ilustra, em qualquer tela. */
const shotClassName = "mx-auto mt-4 aspect-[9/7] w-full max-w-[15rem] md:mt-6 md:max-w-[17rem]";

export function ProblemSection() {
  return (
    <section aria-labelledby="problema-title" className="relative py-14 sm:py-20 md:py-32">
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

        <Reveal stagger className="mt-8 grid gap-3 md:mt-14 md:grid-cols-2 md:gap-5">
          <RevealItem className="rounded-3xl border border-line bg-surface/60 p-5 md:p-9">
            <p className="text-sm font-semibold text-mist">Criando sua própria conta</p>
            <ScreenshotCrop shot={REJECTED} className={shotClassName} />
            <ChecklistItems items={FROM_SCRATCH} tone="alert" />
          </RevealItem>

          <RevealItem className="relative rounded-3xl bg-gradient-brand p-px">
            <div className="h-full rounded-[calc(1.5rem-1px)] bg-surface p-5 md:p-9">
              <p className="flex items-center gap-2 text-sm font-semibold text-white">
                <VerifiedBadge className="size-5" /> Com uma conta Jota Digitais
              </p>
              <ScreenshotCrop shot={APPROVED} className={shotClassName} />
              <ChecklistItems items={WITH_JOTA} tone="electric" />
            </div>
          </RevealItem>
        </Reveal>
      </div>
    </section>
  );
}
