import type { Testimonial, TestimonialKind } from "@/domain/testimonial";
import { Marquee } from "@/ui/components/Marquee";
import { Reveal } from "@/ui/components/Reveal";
import { SectionHeading } from "@/ui/components/SectionHeading";
import { useSiteContent } from "@/ui/hooks/useSiteContent";
import { useTestimonials } from "@/ui/hooks/useStore";
import { cn } from "@/ui/lib/cn";
import { editable } from "@/ui/lib/site-preview";

/** Quantos cards cada metade da faixa precisa para nunca sobrar espaço vazio no fim do loop. */
const MIN_CARDS_PER_LOOP = 12;

const kindTag: Record<TestimonialKind, { label: string; className: string }> = {
  result: { label: "Resultado", className: "bg-pink/90 text-white" },
  delivered: { label: "Conta entregue", className: "bg-electric/90 text-ink" },
};

export function PrintCard({ proof }: { proof: Testimonial }) {
  const tag = kindTag[proof.kind];
  return (
    <li className="shrink-0">
      <figure className="group relative h-full rounded-[1.5rem] border border-line bg-surface p-2 transition-colors duration-300 hover:border-white/20 sm:rounded-[1.75rem] sm:p-2.5">
        <div
          className={cn(
            "overflow-hidden",
            proof.kind === "result" ? "rounded-[1.35rem] sm:rounded-[1.6rem]" : "rounded-[1.1rem] bg-white sm:rounded-[1.25rem]",
          )}
        >
          <img
            src={proof.imageUrl}
            alt={proof.imageAlt}
            width={proof.width}
            height={proof.height}
            loading="lazy"
            decoding="async"
            draggable={false}
            className="h-[18rem] w-auto transition-transform duration-500 group-hover:scale-[1.03] sm:h-[25rem]"
          />
        </div>
        <span
          className={cn(
            "absolute top-4 left-4 rounded-full px-2.5 py-1 text-[0.65rem] font-semibold shadow-lg backdrop-blur sm:top-5 sm:left-5",
            tag.className,
          )}
        >
          {tag.label}
        </span>
        <figcaption className="px-1.5 pt-2.5 pb-1 sm:px-2 sm:pt-3 sm:pb-1.5">
          <p className="font-display text-sm font-semibold text-white">{proof.title}</p>
          <p className="mt-0.5 text-xs text-mist">{proof.subtitle}</p>
        </figcaption>
      </figure>
    </li>
  );
}

function StripSkeleton() {
  return (
    <div aria-hidden className="flex gap-5 overflow-hidden px-4 sm:px-6">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="h-[20rem] w-[9.5rem] shrink-0 animate-pulse rounded-[1.5rem] bg-white/[0.04] sm:h-[27rem] sm:w-[13rem]" />
      ))}
    </div>
  );
}

/** Depoimentos vêm do painel: o Jota publica, reordena ou esconde, e a faixa acompanha. */
export function Results() {
  const testimonials = useTestimonials();
  const { results } = useSiteContent();
  if (testimonials.status === "error") return null;
  if (testimonials.status === "success" && testimonials.data.length === 0) return null;

  return (
    <section
      aria-labelledby="resultados-title"
      className="relative overflow-hidden border-y border-line bg-night py-14 sm:py-20 md:py-32"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/3 left-1/2 h-72 w-[28rem] -translate-x-1/2 rounded-full bg-violet/15 blur-[90px] md:h-[30rem] md:w-[60rem] md:blur-[160px]"
      />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          id="resultados-title"
          editPrefix="results"
          eyebrow={results.eyebrow}
          title={results.title}
          description={results.description}
        />
      </div>

      <Reveal className="relative mt-7 sm:mt-14">
        {testimonials.status === "loading" ? (
          <StripSkeleton />
        ) : (
          <Marquee
            label="Prints de resultados e contas entregues"
            durationSeconds={55}
            repeat={Math.max(2, Math.ceil(MIN_CARDS_PER_LOOP / testimonials.data.length))}
          >
            {testimonials.data.map((proof) => (
              <PrintCard key={proof.id} proof={proof} />
            ))}
          </Marquee>
        )}
      </Reveal>

      <p
        {...editable("results.disclaimer")}
        className="relative mx-auto mt-6 max-w-6xl px-4 text-xs leading-relaxed text-mist sm:mt-10 sm:px-6"
      >
        {results.disclaimer}
      </p>
    </section>
  );
}
