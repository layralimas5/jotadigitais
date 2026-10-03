import { Quote } from "lucide-react";
import { Reveal, RevealItem } from "@/ui/components/Reveal";
import { SectionHeading } from "@/ui/components/SectionHeading";

const RESULTS = [
  {
    amount: "R$ 23.500",
    period: "em comissões no mês",
    quote: "Mas é o que eu falei, ele postava esporadicamente e já deu isso.",
    author: "Marina",
    detail: "cliente do TikTok Shop",
  },
  {
    amount: "R$ 2.900",
    period: "em comissões nos primeiros dias",
    quote: "Não tô acreditando. Tá melhor que o meu principal.",
    author: "Taah",
    detail: "cliente do TikTok Shop",
  },
] as const;

export function Results() {
  return (
    <section aria-labelledby="resultados-title" className="relative overflow-hidden border-y border-line bg-night py-24 md:py-32">
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 left-1/2 h-96 w-[50rem] -translate-x-1/2 rounded-full bg-pink/10 blur-[140px]"
      />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          id="resultados-title"
          eyebrow="Resultados de clientes"
          title="Quem comprou, já está vendendo"
          description="Comissões de afiliado de clientes que compraram contas com o Shop liberado."
        />

        <Reveal stagger className="mt-14 grid gap-5 md:grid-cols-2">
          {RESULTS.map((result) => (
            <RevealItem key={result.author} className="flex flex-col rounded-3xl border border-line bg-surface p-7 md:p-9">
              <p className="font-display text-5xl font-bold tracking-tight text-gradient-brand md:text-6xl">
                {result.amount}
              </p>
              <p className="mt-2 text-sm text-mist">{result.period}</p>
              <figure className="mt-8 flex-1 border-t border-line pt-6">
                <Quote aria-hidden className="size-5 text-electric" />
                <blockquote className="mt-3 text-lg text-pretty text-white">"{result.quote}"</blockquote>
                <figcaption className="mt-4 text-sm text-mist">
                  <span className="font-semibold text-fog">{result.author}</span>, {result.detail}
                </figcaption>
              </figure>
            </RevealItem>
          ))}
        </Reveal>

        <p className="mt-8 text-xs text-mist">
          Resultados individuais. O ganho depende do nicho, dos produtos escolhidos e da frequência de postagem. Não há
          garantia de faturamento.
        </p>
      </div>
    </section>
  );
}
