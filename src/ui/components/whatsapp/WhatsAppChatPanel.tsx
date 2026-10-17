import { motion, useReducedMotion } from "framer-motion";
import { SendHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { whatsappMessageUrl } from "@/domain/store-settings";
import { VerifiedBadge } from "@/ui/components/VerifiedBadge";
import { WhatsAppGlyph } from "./WhatsAppGlyph";

const MAX_MESSAGE_LENGTH = 1000;

interface WhatsAppChatPanelProps {
  id: string;
  whatsappUrl: string;
  onClose: () => void;
}

export function WhatsAppChatPanel({ id, whatsappUrl, onClose }: WhatsAppChatPanelProps) {
  const reduceMotion = useReducedMotion();
  const [message, setMessage] = useState("");
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const canSend = message.trim().length > 0;

  useEffect(() => {
    fieldRef.current?.focus();
  }, []);

  const send = () => {
    if (!canSend) return;
    window.open(whatsappMessageUrl(whatsappUrl, message), "_blank", "noopener,noreferrer");
    setMessage("");
    onClose();
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    send();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  };

  return (
    <motion.div
      id={id}
      role="dialog"
      aria-label="Conversar com o Jota no WhatsApp"
      initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: 12, scale: 0.97 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="w-[min(22rem,calc(100vw-2rem))] origin-bottom-right overflow-hidden rounded-3xl border border-line-strong bg-surface shadow-[0_24px_70px_-20px_rgb(39_153_255/0.55)]"
    >
      <header className="flex items-center gap-3 border-b border-line bg-gradient-to-r from-violet/40 to-electric/25 px-4 py-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-electric text-ink">
          <WhatsAppGlyph className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 font-display text-sm font-semibold text-white">
            Jota Digitais <VerifiedBadge className="size-4" />
          </p>
          <p className="flex items-center gap-1.5 text-xs text-fog">
            <span aria-hidden className="size-1.5 rounded-full bg-emerald-400" /> Costuma responder rápido
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar conversa"
          className="grid size-8 place-items-center rounded-full text-fog transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-electric"
        >
          <X aria-hidden className="size-4" />
        </button>
      </header>

      <div className="space-y-2 px-4 pt-4 pb-3">
        <p className="max-w-[85%] rounded-2xl rounded-tl-md bg-surface-2 px-3.5 py-2.5 text-sm text-white">
          Oi! Aqui é o Jota. 👋 Me conta o que você procura que eu te respondo no WhatsApp.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex items-end gap-2 border-t border-line p-3">
        <label htmlFor={`${id}-message`} className="sr-only">
          Sua mensagem
        </label>
        <textarea
          ref={fieldRef}
          id={`${id}-message`}
          rows={2}
          maxLength={MAX_MESSAGE_LENGTH}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Digite sua mensagem…"
          className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-line bg-ink px-3.5 py-2.5 text-sm text-white placeholder:text-mist focus:border-electric focus:outline-none"
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Enviar no WhatsApp"
          className="grid size-11 shrink-0 place-items-center rounded-full bg-electric text-ink transition-all hover:bg-[#4aaaff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric active:scale-95 disabled:opacity-40"
        >
          <SendHorizontal aria-hidden className="size-5" />
        </button>
      </form>
    </motion.div>
  );
}
