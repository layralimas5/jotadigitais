import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Plus } from "lucide-react";
import { useId, useState } from "react";
import { FULL_SHOP_MIN_FOLLOWERS } from "@/domain/account";
import { Reveal } from "@/ui/components/Reveal";
import { SectionHeading } from "@/ui/components/SectionHeading";
import { cn } from "@/ui/lib/cn";

export const FAQ_ITEMS = [
  {
    question: "Posso mudar o nome, o @ e a foto da conta?",
    answer:
      "Pode. Depois da compra a conta é sua: você altera nome de usuário, foto e bio como quiser e se cadastra no TikTok Shop com os seus dados.",
  },
  {
    question: "O que é o Shop piloto?",
    answer: `Contas com menos de ${FULL_SHOP_MIN_FOLLOWERS.toLocaleString("pt-BR")} seguidores estão no modo piloto (fase beta) do TikTok Shop. Tudo funciona normalmente, só alguns produtos ainda não ficam disponíveis para afiliação até a conta crescer.`,
  },
  {
    question: "O nicho da conta importa?",
    answer:
      "Não. Você pode mudar o tipo de conteúdo e vender produtos de qualquer categoria. Os seguidores também não precisam ser de um gênero específico.",
  },
  {
    question: "Vou perder seguidores quando trocar os dados?",
    answer: "Não. Os seguidores são reais e brasileiros e continuam na conta depois da troca de nome e foto.",
  },
  {
    question: "Como recebo a conta?",
    answer:
      "Assim que o pagamento é confirmado, enviamos login, senha e o passo a passo para o e-mail informado na compra.",
  },
  {
    question: "Quais as formas de pagamento?",
    answer: "Pix à vista ou cartão de crédito em até 12x (com juros da operadora).",
  },
] as const;

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
          className="flex w-full items-center justify-between gap-6 py-6 text-left font-display text-base font-medium text-white transition-colors hover:text-electric-soft md:text-lg"
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
            <p className="max-w-2xl pb-6 text-sm leading-relaxed text-mist md:text-base">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Faq() {
  return (
    <section id="duvidas" aria-labelledby="duvidas-title" className="relative border-t border-line bg-night py-24 md:py-32">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionHeading
          id="duvidas-title"
          eyebrow="Dúvidas"
          title="Perguntas frequentes"
          description="Não achou o que procurava? Fale com a gente no Instagram."
        />
        <Reveal className="border-t border-line">
          {FAQ_ITEMS.map((item) => (
            <FaqItem key={item.question} {...item} />
          ))}
        </Reveal>
      </div>
    </section>
  );
}
