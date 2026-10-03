import { Quote } from "lucide-react";
import { Marquee } from "@/ui/components/Marquee";
import { Reveal } from "@/ui/components/Reveal";
import { SectionHeading } from "@/ui/components/SectionHeading";
import { VerifiedBadge } from "@/ui/components/VerifiedBadge";
import { cn } from "@/ui/lib/cn";

type PrintKind = "result" | "delivered";

interface PrintProof {
  src: string;
  width: number;
  height: number;
  alt: string;
  kind: PrintKind;
  title: string;
  subtitle: string;
}

/** Prints reais do material da Jota. Nos perfis entregues, nome, @ e foto foram desfocados. */
const PRINTS: PrintProof[] = [
  {
    src: "/images/depoimento-marina.webp",
    width: 553,
    height: 1200,
    alt: "WhatsApp da cliente Marina com o painel do TikTok Shop: R$ 23,5 mil em comissões estimadas no mês.",
    kind: "result",
    title: "R$ 23,5 mil no mês",
    subtitle: "Marina, em comissões",
  },
  {
    src: "/images/conta-entregue-1.webp",
    width: 540,
    height: 1063,
    alt: "Perfil de conta entregue com a aba TikTok Shop para criadores ativa e 1.093 seguidores.",
    kind: "delivered",
    title: "Shop para criadores ativo",
    subtitle: "1.093 seguidores",
  },
  {
    src: "/images/depoimento-taah.webp",
    width: 553,
    height: 1200,
    alt: "WhatsApp da cliente Taah com o painel do TikTok Shop: R$ 2,9 mil em comissões estimadas no dia.",
    kind: "result",
    title: "R$ 2,9 mil em um dia",
    subtitle: "Taah, em comissões",
  },
  {
    src: "/images/conta-entregue-2.webp",
    width: 540,
    height: 1063,
    alt: "Perfil de conta entregue com a opção Comece a receber pagamentos do TikTok Shop e 1.129 seguidores.",
    kind: "delivered",
    title: "Pagamentos do Shop liberados",
    subtitle: "1.129 seguidores",
  },
  {
    src: "/images/conta-entregue-3.webp",
    width: 540,
    height: 1063,
    alt: "Perfil de conta entregue com a vitrine ativa, link de afiliado e 1.517 seguidores.",
    kind: "delivered",
    title: "Vitrine e link de afiliado",
    subtitle: "1.517 seguidores",
  },
  {
    src: "/images/conta-entregue-4.webp",
    width: 540,
    height: 1063,
    alt: "Perfil de conta entregue com a opção Comece a receber pagamentos do TikTok Shop e 1.061 seguidores.",
    kind: "delivered",
    title: "Pronta para vender",
    subtitle: "1.061 seguidores",
  },
];

type TextProof =
  | { kind: "stat"; value: string; label: string; author: string }
  | { kind: "quote"; text: string; author: string };

/** Números e falas tirados dos mesmos prints, sem arredondar para cima. */
const TEXT_PROOFS: TextProof[] = [
  { kind: "stat", value: "R$ 203,7 mil", label: "em vendas com comissão (GMV) no mês", author: "Marina" },
  { kind: "quote", text: "Mas é o q eu falei, ele postava esporadicamente e já deu isso kkkk", author: "Marina" },
  { kind: "stat", value: "R$ 29,2 mil", label: "em vendas com comissão (GMV) em um único dia", author: "Taah" },
  { kind: "quote", text: "Não to acreditando", author: "Taah" },
  { kind: "stat", value: "2,9 mil", label: "itens vendidos com comissão no mês", author: "Marina" },
  { kind: "quote", text: "Tá melhor que o meu principal", author: "Taah" },
  { kind: "stat", value: "920", label: "itens vendidos com comissão em um dia", author: "Taah" },
  { kind: "quote", text: "Esse foi o GMV e comissão do mês que compramos", author: "Marina" },
];

const kindTag: Record<PrintKind, { label: string; className: string }> = {
  result: { label: "Resultado", className: "bg-pink/90 text-white" },
  delivered: { label: "Conta entregue", className: "bg-electric/90 text-ink" },
};

function PrintCard({ proof }: { proof: PrintProof }) {
  const tag = kindTag[proof.kind];
  return (
    <li className="shrink-0">
      <figure className="group relative h-full rounded-[1.75rem] border border-line bg-surface p-2.5 transition-colors duration-300 hover:border-white/20">
        <div className={cn("overflow-hidden", proof.kind === "result" ? "rounded-[1.6rem]" : "rounded-[1.25rem] bg-white")}>
          <img
            src={proof.src}
            alt={proof.alt}
            width={proof.width}
            height={proof.height}
            loading="lazy"
            decoding="async"
            draggable={false}
            className="h-[21rem] w-auto transition-transform duration-500 group-hover:scale-[1.03] sm:h-[25rem]"
          />
        </div>
        <span
          className={cn(
            "absolute top-5 left-5 rounded-full px-2.5 py-1 text-[0.65rem] font-semibold shadow-lg backdrop-blur",
            tag.className,
          )}
        >
          {tag.label}
        </span>
        <figcaption className="px-2 pt-3 pb-1.5">
          <p className="font-display text-sm font-semibold text-white">{proof.title}</p>
          <p className="mt-0.5 text-xs text-mist">{proof.subtitle}</p>
        </figcaption>
      </figure>
    </li>
  );
}

function TextProofCard({ proof }: { proof: TextProof }) {
  return (
    <li className="w-[17rem] shrink-0 sm:w-[19rem]">
      <figure className="flex h-full flex-col justify-between rounded-3xl border border-line bg-surface p-6">
        {proof.kind === "stat" ? (
          <div>
            <p className="font-display text-3xl font-bold tracking-tight whitespace-nowrap text-gradient-brand">
              {proof.value}
            </p>
            <p className="mt-2 text-sm text-fog">{proof.label}</p>
          </div>
        ) : (
          <div>
            <Quote aria-hidden className="size-5 text-electric" />
            <blockquote className="mt-3 text-base text-pretty text-white">"{proof.text}"</blockquote>
          </div>
        )}
        <figcaption className="mt-6 flex items-center gap-2 text-xs text-mist">
          <VerifiedBadge className="size-4" />
          <span>
            <span className="font-semibold text-fog">{proof.author}</span>, cliente do TikTok Shop
          </span>
        </figcaption>
      </figure>
    </li>
  );
}

export function Results() {
  return (
    <section aria-labelledby="resultados-title" className="relative overflow-hidden border-y border-line bg-night py-24 md:py-32">
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/3 left-1/2 h-[30rem] w-[60rem] -translate-x-1/2 rounded-full bg-violet/15 blur-[160px]"
      />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            id="resultados-title"
            eyebrow="Resultados de clientes"
            title="Quem comprou, já está vendendo"
            description="Prints reais: comissões de clientes e contas entregues com o TikTok Shop liberado."
          />
          <Reveal className="flex gap-3">
            <div className="flex-1 rounded-2xl border border-line bg-surface/70 px-4 py-4 sm:flex-none sm:px-5">
              <p className="font-display text-xl font-bold whitespace-nowrap text-white sm:text-2xl">R$ 23,5 mil</p>
              <p className="text-xs text-mist">Marina, comissões no mês</p>
            </div>
            <div className="flex-1 rounded-2xl border border-line bg-surface/70 px-4 py-4 sm:flex-none sm:px-5">
              <p className="font-display text-xl font-bold whitespace-nowrap text-white sm:text-2xl">R$ 2,9 mil</p>
              <p className="text-xs text-mist">Taah, comissões em um dia</p>
            </div>
          </Reveal>
        </div>
      </div>

      <Reveal className="relative mt-14 space-y-5">
        <Marquee label="Prints de resultados e contas entregues" durationSeconds={55}>
          {PRINTS.map((proof) => (
            <PrintCard key={proof.src} proof={proof} />
          ))}
        </Marquee>
        <Marquee label="Números e falas de clientes" durationSeconds={45}>
          {TEXT_PROOFS.map((proof) => (
            <TextProofCard key={proof.kind === "stat" ? proof.value : proof.text} proof={proof} />
          ))}
        </Marquee>
      </Reveal>

      <p className="relative mx-auto mt-10 max-w-6xl px-4 text-xs text-mist sm:px-6">
        Resultados individuais. O ganho depende do nicho, dos produtos escolhidos e da frequência de postagem. Não há
        garantia de faturamento. Nos perfis entregues, nome, @ e foto foram desfocados para preservar os novos donos.
      </p>
    </section>
  );
}
