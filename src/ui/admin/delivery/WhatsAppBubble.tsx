import { Fragment } from "react";
import { cn } from "@/ui/lib/cn";

const BOLD = /(\*[^*\n]+\*)/g;

/** Mostra o *negrito* do WhatsApp como ele vai aparecer na conversa. */
function WhatsAppText({ text }: { text: string }) {
  return (
    <>
      {text.split(BOLD).map((part, index) =>
        part.startsWith("*") && part.endsWith("*") && part.length > 2 ? (
          <strong key={index} className="font-semibold text-white">
            {part.slice(1, -1)}
          </strong>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}

/** Balão verde de mensagem enviada, no fundo escuro da conversa, igual ao WhatsApp Web. */
export function WhatsAppBubble({ text, className }: { text: string; className?: string }) {
  return (
    <div aria-label="Prévia da mensagem no WhatsApp" className={cn("rounded-2xl bg-[#0b141a] p-3 sm:p-4", className)}>
      <p className="ml-auto max-w-[min(100%,30rem)] rounded-xl rounded-tr-sm bg-[#005c4b] px-3 py-2 text-sm leading-relaxed whitespace-pre-line text-[#e9edef] [overflow-wrap:anywhere]">
        {text ? <WhatsAppText text={text} /> : "…"}
      </p>
    </div>
  );
}
