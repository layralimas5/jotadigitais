import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Plus } from "lucide-react";
import { useId, useState } from "react";
import { Reveal } from "@/ui/components/Reveal";
import { SectionHeading } from "@/ui/components/SectionHeading";
import { useFillTokens, useSiteContent } from "@/ui/hooks/useSiteContent";
import { cn } from "@/ui/lib/cn";

/** Perguntas do painel, com os marcadores trocados. `tiktokOnly` aparece só onde a rede é TikTok (ou na home). */
export function useFaqItems() {
  const { faq } = useSiteContent();
  const fill = useFillTokens();
  return faq.items.map((item) => ({ ...item, question: fill(item.question), answer: fill(item.answer) }));
}

export function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const panelId = useId();
  const buttonId = useId();

  return (
    <div className="border-b border-line">
      <h3>
        <button
          id={buttonId}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center justify-between gap-4 py-4 text-left font-display text-[0.95rem] font-medium text-white transition-colors hover:text-electric-soft sm:gap-6 sm:py-6 sm:text-base md:text-lg"
        >
          {question}
          <span
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-full border border-line-strong transition-transform duration-300",
              open && "rotate-45 border-electric text-electric",
            )}
          >
            <Plus aria-hidden className="size-4" />
          </span>
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            role="region"
            aria-labelledby={buttonId}
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <p className="max-w-2xl pb-4 text-sm leading-relaxed text-mist sm:pb-6 md:text-base">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Faq() {
  const { faq } = useSiteContent();
  const fill = useFillTokens();
  const items = useFaqItems();
  return (
    <section id="duvidas" aria-labelledby="duvidas-title" className="relative border-t border-line bg-night py-14 sm:py-20 md:py-32">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:gap-12 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionHeading
          id="duvidas-title"
          eyebrow={fill(faq.eyebrow)}
          title={fill(faq.title)}
          description={fill(faq.description)}
        />
        <Reveal className="border-t border-line">
          {items.map((item, index) => (
            <FaqItem key={index} question={item.question} answer={item.answer} />
          ))}
        </Reveal>
      </div>
    </section>
  );
}
