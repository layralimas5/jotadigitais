import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useStoreSettings } from "@/ui/hooks/useStoreSettings";
import { useWhatsAppTeaser } from "./useWhatsAppTeaser";
import { WhatsAppChatPanel } from "./WhatsAppChatPanel";
import { WhatsAppGlyph } from "./WhatsAppGlyph";
import { WhatsAppTeaser } from "./WhatsAppTeaser";

const PULSE_DURATION_S = 2.6;

/** Brilho que respira atrás do botão e um anel que se expande devagar, em loop. */
function PulseRings() {
  return (
    <>
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-2 -z-10 rounded-full bg-electric/50 blur-xl"
        animate={{ opacity: [0.45, 0.9, 0.45], scale: [0.95, 1.08, 0.95] }}
        transition={{ duration: PULSE_DURATION_S, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full border-2 border-electric/70"
        animate={{ opacity: [0.7, 0], scale: [1, 1.55] }}
        transition={{ duration: PULSE_DURATION_S, repeat: Infinity, ease: "easeOut" }}
      />
    </>
  );
}

export function WhatsAppWidget() {
  const { whatsappUrl } = useStoreSettings();
  const panelId = useId();
  const reduceMotion = useReducedMotion();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const teaser = useWhatsAppTeaser();

  const openChat = () => {
    teaser.dismiss();
    setOpen(true);
  };

  const closeChat = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!whatsappUrl) return null;

  const showTeaser = teaser.visible && !open;

  return (
    <div className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-3 sm:right-6 sm:bottom-6">
      <AnimatePresence>
        {open && <WhatsAppChatPanel key="panel" id={panelId} whatsappUrl={whatsappUrl} onClose={closeChat} />}
        {showTeaser && <WhatsAppTeaser key="teaser" onOpen={openChat} onDismiss={teaser.dismiss} />}
      </AnimatePresence>

      <button
        ref={triggerRef}
        type="button"
        onClick={open ? closeChat : openChat}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={open ? "Fechar conversa com o Jota" : "Falar com o Jota no WhatsApp"}
        className="relative grid size-14 place-items-center rounded-full bg-gradient-to-b from-[#6cc0ff] via-electric to-[#1478e0] text-ink shadow-[inset_0_1px_1px_rgb(255_255_255/0.6),inset_0_-2px_6px_rgb(0_40_120/0.35),0_0_0_1px_rgb(39_153_255/0.6),0_0_28px_rgb(39_153_255/0.65),0_12px_40px_-10px_rgb(39_153_255/0.9)] transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-electric active:scale-95"
      >
        {!open && !reduceMotion && <PulseRings />}
        <span aria-hidden className="pointer-events-none absolute inset-x-2.5 top-1 h-1/3 rounded-full bg-gradient-to-b from-white/55 to-transparent" />
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={open ? "close" : "chat"}
            initial={reduceMotion ? false : { rotate: -45, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={reduceMotion ? undefined : { rotate: 45, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="relative"
          >
            {open ? <X aria-hidden className="size-6" /> : <WhatsAppGlyph className="size-7" />}
          </motion.span>
        </AnimatePresence>
        <AnimatePresence>
          {showTeaser && (
            <motion.span
              aria-hidden
              initial={reduceMotion ? false : { scale: 0 }}
              animate={{ scale: 1 }}
              exit={reduceMotion ? undefined : { scale: 0 }}
              className="absolute -top-0.5 -right-0.5 grid size-5 place-items-center rounded-full border-2 border-ink bg-pink text-[0.65rem] font-bold text-ink"
            >
              1
            </motion.span>
          )}
        </AnimatePresence>
      </button>
    </div>
  );
}
