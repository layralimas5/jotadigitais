import { motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { useSiteContent } from "@/ui/hooks/useSiteContent";
import { editable } from "@/ui/lib/site-preview";

interface WhatsAppTeaserProps {
  onOpen: () => void;
  onDismiss: () => void;
}

export function WhatsAppTeaser({ onOpen, onDismiss }: WhatsAppTeaserProps) {
  const reduceMotion = useReducedMotion();
  const { whatsapp } = useSiteContent();
  return (
    <motion.div
      role="status"
      initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: 8, scale: 0.96 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="relative origin-bottom-right rounded-2xl rounded-br-md border border-line-strong bg-surface-2/95 py-3 pr-9 pl-4 shadow-[0_18px_50px_-18px_rgb(39_153_255/0.55)] backdrop-blur-xl"
    >
      <button
        type="button"
        onClick={onOpen}
        className="text-left text-sm font-medium text-white after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none"
      >
        <span {...editable("whatsapp.teaserTitle")}>{whatsapp.teaserTitle}</span>
        <span {...editable("whatsapp.teaserText")} className="mt-0.5 block text-xs font-normal text-mist">
          {whatsapp.teaserText}
        </span>
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Fechar convite"
        className="absolute top-2 right-2 z-10 grid size-6 place-items-center rounded-full text-mist transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-electric"
      >
        <X aria-hidden className="size-3.5" />
      </button>
    </motion.div>
  );
}
