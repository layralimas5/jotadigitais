import { Quote } from "lucide-react";
import { Reveal, RevealItem } from "@/ui/components/Reveal";
import { SectionHeading } from "@/ui/components/SectionHeading";

const RESULTS = [
  {
    amount: "R$ 23.500",
    period: "em comissões no mês",
    quote: "Mas é o que eu falei, ele postava esporadicamente e já deu isso.",
    author: "Marina",
    image: "/images/depoimento-marina.webp",
    alt: "Conversa no WhatsApp com a cliente Marina mostrando o painel do TikTok Shop com R$ 23,5 mil em comissões estimadas no mês.",
  },
  {
    amount: "R$ 2.900",
    period: "em comissões em um único dia",
    quote: "Não tô acreditando. Tá melhor que o meu principal.",
    author: "Taah",
    image: "/images/depoimento-taah.webp",
    alt: "Conversa no WhatsApp com a cliente Taah mostrando o painel do TikTok Shop com R$ 2,9 mil em comissões estimadas no dia.",
  },
] as const;

const PRINT_WIDTH = 553;
const PRINT_HEIGHT = 1200;

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
          description="Prints reais das conversas com clientes que compraram contas com o Shop liberado."
        />

        <Reveal stagger className="mt-14 grid gap-5 lg:grid-cols-2">
          {RESULTS.map((result) => (
            <RevealItem key={result.author}>
              <figure className="group flex h-full flex-col gap-7 overflow-hidden rounded-3xl border border-line bg-surface p-6 sm:flex-row sm:items-center md:p-8">
                <div className="relative mx-auto w-48 shrink-0 sm:mx-0 sm:w-44 md:w-52">
                  <div
                    aria-hidden
                    className="absolute inset-4 rounded-[2rem] bg-gradient-brand opacity-50 blur-2xl transition-opacity duration-500 group-hover:opacity-80"
                  />
                  <img
                    src={result.image}
                    alt={result.alt}
                    width={PRINT_WIDTH}
                    height={PRINT_HEIGHT}
                    loading="lazy"
                    decoding="async"
                    className="relative h-auto w-full -rotate-2 drop-shadow-2xl transition-transform duration-500 group-hover:rotate-0"
                  />
                </div>

                <div className="flex flex-1 flex-col">
                  <p className="font-display text-4xl font-bold tracking-tight whitespace-nowrap text-gradient-brand">
                    {result.amount}
                  </p>
                  <p className="mt-2 text-sm text-mist">{result.period}</p>
                  <div className="mt-6 border-t border-line pt-6">
                    <Quote aria-hidden className="size-5 text-electric" />
                    <blockquote className="mt-3 text-lg text-pretty text-white">"{result.quote}"</blockquote>
                    <figcaption className="mt-4 text-sm text-mist">
                      <span className="font-semibold text-fog">{result.author}</span>, cliente do TikTok Shop
                    </figcaption>
                  </div>
                </div>
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
