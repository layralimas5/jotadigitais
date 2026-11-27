import { CalendarClock, MessageCircle } from "lucide-react";
import { useState } from "react";
import { DEVELOPER_WHATSAPP, SUPPORT_HOURS_LABEL, isSupportWeekend } from "@/domain/support-hours";
import type { SupportRole } from "@/domain/support-ticket";
import { buttonClasses, Button } from "@/ui/components/Button";
import { Modal } from "../components/Modal";
import { whatsappChatUrl } from "../lib/whatsapp";

const URGENT_MESSAGE = "Oi Lay, é urgente: ";

/**
 * Pedido da Lay: no sábado e no domingo, quem abre o Suporte do lado do Jota vê o horário de atendimento
 * e o WhatsApp dela para o que for urgente.
 */
export function WeekendNotice({ role }: { role: SupportRole }) {
  const [open, setOpen] = useState(() => role === "admin" && isSupportWeekend(new Date()));
  const close = () => setOpen(false);

  return (
    <Modal open={open} title="Hoje é fim de semana" onClose={close} placement="center">
      <div className="flex gap-3 rounded-2xl border border-electric/35 bg-electric/[0.07] p-4">
        <CalendarClock aria-hidden className="mt-0.5 size-5 shrink-0 text-electric" />
        <div className="space-y-2 text-sm leading-relaxed text-fog">
          <p>
            Nosso horário de atendimento é de <strong className="text-white">{SUPPORT_HOURS_LABEL}</strong>.
          </p>
          <p>Pode abrir o chamado normalmente que eu vejo assim que voltar. Se for urgente, me dá um toque no WhatsApp.</p>
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-2">
        <a
          href={whatsappChatUrl(DEVELOPER_WHATSAPP, URGENT_MESSAGE)}
          target="_blank"
          rel="noreferrer"
          onClick={close}
          className={buttonClasses({ className: "w-full" })}
        >
          <MessageCircle aria-hidden className="size-4" /> É urgente: chamar no WhatsApp
        </a>
        <Button type="button" variant="secondary" className="w-full" onClick={close}>
          Entendi
        </Button>
      </div>
    </Modal>
  );
}
