import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Plus } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { Platform } from "@/domain/platform";
import { faqAnchorOf, type FaqTopic } from "@/domain/site-content";
import { Reveal } from "@/ui/components/Reveal";
import { SectionHeading } from "@/ui/components/SectionHeading";
import { useFillTokens, useSiteContent } from "@/ui/hooks/useSiteContent";
import { cn } from "@/ui/lib/cn";
import { editable } from "@/ui/lib/site-preview";

/** Perguntas do painel, com os marcadores trocados. `tiktokOnly` aparece só onde a rede é TikTok (ou na home). */
export function useFaqItems() {
  const { faq } = useSiteContent();
  const fill = useFillTokens();
  return faq.items.map((item) => ({ ...item, question: fill(item.question), answer: fill(item.answer) }));
}

/** Perguntas da página de uma conta: as "só TikTok" saem das outras redes. A primeira de cada assunto ganha a âncora. */
export function useAccountFaqItems(platform: Platform) {
  const items = useFaqItems().filter((item) => !item.tiktokOnly || platform === "tiktok");
  const anchored = new Set<FaqTopic>();
  return items.map((item) => {
    if (!item.topic || anchored.has(item.topic)) return { ...item, anchorId: undefined };
    anchored.add(item.topic);
    return { ...item, anchorId: faqAnchorOf(item.topic) };
  });
}

/** Pedido para abrir uma pergunta pela âncora (o link "Entenda" do quadro da conta). */
const FAQ_OPEN_EVENT = "jota:faq-open";

/** Leva até a pergunta da âncora e abre a resposta, mesmo se o endereço já estiver nela. */
export function openFaqAnchor(anchorId: string, smooth: boolean) {
  window.history.replaceState(window.history.state, "", `#${anchorId}`);
  window.dispatchEvent(new CustomEvent<string>(FAQ_OPEN_EVENT, { detail: anchorId }));
  // Rola depois que a pergunta abriu e ganhou o foco: o foco no meio da rolagem suave a cancelava.
  requestAnimationFrame(() => {
    document.getElementById(anchorId)?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
  });
}

/** Abre a pergunta quando a página chega na âncora dela ou quando um link "Entenda" pede. */
function useAnchorOpen(anchorId: string | undefined, open: () => void) {
  const openRef = useRef(open);
  openRef.current = open;
  useEffect(() => {
    if (!anchorId) return;
    if (window.location.hash === `#${anchorId}`) openRef.current();
    const onOpen = (event: Event) => {
      if ((event as CustomEvent<string>).detail === anchorId) openRef.current();
    };
    window.addEventListener(FAQ_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(FAQ_OPEN_EVENT, onOpen);
  }, [anchorId]);
}

interface FaqItemProps {
  question: string;
  answer: string;
  /** `editPath` (ex.: "faq.items.2") liga pergunta e resposta aos campos do editor na prévia do painel. */
  editPath?: string;
  /** Âncora para o link "Entenda" do quadro da conta chegar aqui com a resposta aberta. */
  anchorId?: string;
}

export function FaqItem({ question, answer, editPath, anchorId }: FaqItemProps) {
  const edit = (field: string) => (editPath ? editable(`${editPath}.${field}`) : {});
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const panelId = useId();
  const buttonId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  useAnchorOpen(anchorId, () => {
    setOpen(true);
    buttonRef.current?.focus({ preventScroll: true });
  });

  return (
    <div id={anchorId} className="scroll-mt-28 border-b border-line">
      <h3>
        <button
          ref={buttonRef}
          id={buttonId}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center justify-between gap-4 py-4 text-left font-display text-[0.95rem] font-medium text-white transition-colors hover:text-electric-soft sm:gap-6 sm:py-6 sm:text-base md:text-lg"
        >
          <span {...edit("question")}>{question}</span>
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
            <p {...edit("answer")} className="max-w-2xl pb-4 text-sm leading-relaxed text-mist sm:pb-6 md:text-base">
              {answer}
            </p>
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
          editPrefix="faq"
          eyebrow={fill(faq.eyebrow)}
          title={fill(faq.title)}
          description={fill(faq.description)}
        />
        <Reveal className="border-t border-line">
          {items.map((item, index) => (
            <FaqItem key={index} question={item.question} answer={item.answer} editPath={`faq.items.${index}`} />
          ))}
        </Reveal>
      </div>
    </section>
  );
}
