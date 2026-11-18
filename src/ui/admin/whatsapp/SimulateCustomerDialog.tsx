import { useState, type FormEvent } from "react";
import { simulateWhatsAppInbound } from "@/application/admin-use-cases";
import type { InboundOutcome } from "@/domain/whatsapp";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/form/Fields";
import { InlineError } from "../components/AdminUi";
import { TextAreaField } from "../components/FormControls";
import { Modal } from "../components/Modal";
import { useMutation } from "../hooks";
import { useToast } from "../toast";

const OUTCOME_MESSAGE: Record<InboundOutcome, string> = {
  replied: "A IA respondeu. Veja a conversa.",
  flow: "O fluxo respondeu. Veja a conversa.",
  handoff: "A IA passou a conversa para você.",
  staff: "A conversa já está com você: a IA não respondeu.",
  ai_off: "A IA está desligada ou fora do horário: a mensagem ficou esperando você.",
  ignored: "Esse número está na lista de ignorados: a IA não respondeu.",
  opted_out: "Esse cliente pediu para parar as mensagens automáticas.",
  duplicate: "Mensagem repetida: nada mudou.",
};

const TEST_PHONE = "5527900000001";

interface SimulateCustomerDialogProps {
  open: boolean;
  onClose: () => void;
  onDone: (contactId: string) => void;
}

/** Modo teste: finge que um cliente mandou mensagem no WhatsApp da loja e roda o atendimento inteiro. */
export function SimulateCustomerDialog({ open, onClose, onDone }: SimulateCustomerDialogProps) {
  const toast = useToast();
  const [phone, setPhone] = useState(TEST_PHONE);
  const [name, setName] = useState("Cliente teste");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const simulate = useMutation(simulateWhatsAppInbound);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const digits = phone.replace(/\D/g, "");
    if (!/^\d{12,13}$/.test(digits)) {
      setError("Use o número com 55 e DDD. Ex.: 5527999998888.");
      return;
    }
    if (!text.trim()) {
      setError("Escreva a mensagem do cliente.");
      return;
    }
    setError(null);
    const result = await simulate.run(digits, name.trim() || null, text.trim());
    if (!result) return;
    setText("");
    toast.show(OUTCOME_MESSAGE[result.outcome]);
    onDone(result.contactId);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Simular mensagem de cliente"
      description="Só no modo teste. Roda o atendimento inteiro (IA, passagem para você, avisos) sem mandar nada para ninguém."
    >
      <form noValidate onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="WhatsApp do cliente" inputMode="numeric" value={phone} onChange={(event) => setPhone(event.target.value)} />
          <TextField label="Nome" value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
        </div>
        <TextAreaField
          label="Mensagem"
          placeholder="Ex.: Tem conta de TikTok até 400 reais?"
          value={text}
          maxLength={1000}
          onChange={(event) => setText(event.target.value)}
        />
        {(error || simulate.error) && <InlineError message={error ?? simulate.error?.message ?? ""} />}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Fechar
          </Button>
          <Button type="submit" disabled={simulate.pending}>
            {simulate.pending ? "Enviando…" : "Enviar como cliente"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
