import { Marquee } from "@/ui/components/Marquee";
import { Reveal } from "@/ui/components/Reveal";
import { SectionHeading } from "@/ui/components/SectionHeading";
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

export function Results() {
  return (
    <section aria-labelledby="resultados-title" className="relative overflow-hidden border-y border-line bg-night py-24 md:py-32">
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/3 left-1/2 h-[30rem] w-[60rem] -translate-x-1/2 rounded-full bg-violet/15 blur-[160px]"
      />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          id="resultados-title"
          eyebrow="Resultados de clientes"
          title="Quem comprou, já está vendendo"
          description="Prints reais: comissões de clientes e contas entregues com o TikTok Shop liberado."
        />
      </div>

      <Reveal className="relative mt-14">
        <Marquee label="Prints de resultados e contas entregues" durationSeconds={55}>
          {PRINTS.map((proof) => (
            <PrintCard key={proof.src} proof={proof} />
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
