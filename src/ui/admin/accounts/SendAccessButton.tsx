import { KeyRound } from "lucide-react";
import { useState } from "react";
import type { Order } from "@/domain/order";
import { Button } from "@/ui/components/Button";
import { DeliveryDialog } from "../delivery/DeliveryDialog";

/**
 * Pedido pago: abre o card de entrega, com a mensagem pronta (e-mail e login do perfil da ficha da conta), as
 * mensagens salvas e o editor. De lá sai o WhatsApp de quem comprou. Pedido já entregue usa o `resend`, mais discreto.
 */
export function SendAccessButton({ order, resend = false }: { order: Order; resend?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!order.customer.whatsapp) return null;
  return (
    <>
      {resend ? (
        <Button variant="secondary" onClick={() => setOpen(true)} aria-haspopup="dialog" className="sm:mr-auto">
          <KeyRound aria-hidden className="size-4" /> Reenviar acesso
        </Button>
      ) : (
        <Button
          size="lg"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className="bg-[#25d366] text-ink shadow-none hover:bg-[#3be07a] hover:shadow-none sm:mr-auto"
        >
          <KeyRound aria-hidden className="size-4" /> Enviar acesso no WhatsApp
        </Button>
      )}
      <DeliveryDialog order={open ? order : null} onClose={() => setOpen(false)} />
    </>
  );
}
