import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import type { SupportActivity } from "@/domain/support-activity";
import { PersonAvatar } from "../components/PersonAvatar";

/** Quanto tempo cada aviso fica na tela antes de sumir sozinho. */
export const SUPPORT_TOAST_MS = 20_000;
/** Avisos ao mesmo tempo: o mais antigo sai quando chega o quarto. */
export const MAX_SUPPORT_TOASTS = 3;

const ACTION_LABEL: Record<SupportActivity["kind"], string> = { opened: "abriu um chamado", replied: "respondeu" };

const firstName = (activity: SupportActivity) => activity.author.name?.trim().split(/\s+/)[0] || "Alguém";

interface SupportActivityToastsProps {
  items: readonly SupportActivity[];
  onClose: (key: string) => void;
}

/** Balões no canto inferior direito, no estilo do aviso de mensagem do MSN: sobem, esperam 20 segundos e somem. */
export function SupportActivityToasts({ items, onClose }: SupportActivityToastsProps) {
  return (
    <section
      aria-label="Avisos do suporte"
      aria-live="polite"
      className="pointer-events-none fixed right-3 bottom-[calc(10.75rem+env(safe-area-inset-bottom))] z-[70] flex w-[min(20rem,calc(100vw-1.5rem))] flex-col gap-2 md:right-6 md:bottom-6"
    >
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <SupportActivityToast key={item.key} item={item} onClose={onClose} />
        ))}
      </AnimatePresence>
    </section>
  );
}

function SupportActivityToast({ item, onClose }: { item: SupportActivity; onClose: (key: string) => void }) {
  const reduceMotion = useReducedMotion();
  const name = firstName(item);

  useEffect(() => {
    const timer = window.setTimeout(() => onClose(item.key), SUPPORT_TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [item.key, onClose]);

  return (
    <motion.article
      layout={!reduceMotion}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 48, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, transition: { duration: 0.2 } }}
      transition={reduceMotion ? { duration: 0.15 } : { type: "spring", stiffness: 420, damping: 32 }}
      className="pointer-events-auto relative overflow-hidden rounded-2xl border border-line-strong bg-surface/95 shadow-[0_18px_50px_-12px_rgb(0_0_0/0.85)] backdrop-blur-xl"
    >
      <Link
        to={`/admin/suporte/${item.ticketId}`}
        onClick={() => onClose(item.key)}
        className="flex items-start gap-2.5 rounded-2xl py-2.5 pr-9 pl-3 outline-none focus-visible:ring-2 focus-visible:ring-electric"
      >
        <PersonAvatar name={item.author.name ?? name} src={item.author.avatarUrl} className="mt-0.5 size-8 text-[0.65rem]" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.8rem] text-white">
            <strong className="font-semibold">{name}</strong> <span className="text-mist">{ACTION_LABEL[item.kind]}</span>
          </span>
          <span className="block truncate text-[0.72rem] font-medium text-electric">{item.ticketTitle}</span>
          <span className="mt-0.5 line-clamp-2 text-[0.72rem] leading-snug text-mist">{item.body}</span>
        </span>
      </Link>
      <button
        type="button"
        onClick={() => onClose(item.key)}
        aria-label={`Fechar aviso de ${name}`}
        className="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full text-mist transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-electric focus-visible:outline-none"
      >
        <X aria-hidden className="size-3.5" />
      </button>
      {!reduceMotion && (
        <motion.span
          aria-hidden
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: SUPPORT_TOAST_MS / 1000, ease: "linear" }}
          className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-electric/60"
        />
      )}
    </motion.article>
  );
}
