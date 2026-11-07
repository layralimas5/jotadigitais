import { Copy, MessageCircle } from "lucide-react";
import { useState } from "react";
import { siteConfig } from "@/app/config";
import { accessMessage } from "@/domain/access-user";
import { Button, buttonClasses } from "@/ui/components/Button";
import { TextField } from "@/ui/components/form/Fields";
import { cn } from "@/ui/lib/cn";
import { TextAreaField } from "../components/FormControls";
import { Modal } from "../components/Modal";
import { useCopy } from "../emails/use-copy";
import { formatPhone, whatsappChatUrl } from "../lib/whatsapp";

export interface AccessToSend {
  name: string | null;
  email: string;
  whatsapp: string | null;
  /** Nula quando só se manda o link e o e-mail. */
  password: string | null;
}

const onlyDigits = (value: string) => value.replace(/\D/g, "");
const isValidPhone = (digits: string) => digits.length >= 10 && digits.length <= 13;

/** Sem número, o WhatsApp abre a lista de conversas para escolher para quem mandar. */
const whatsappLink = (phone: string, text: string) =>
  phone ? whatsappChatUrl(phone, text) : `https://wa.me/?text=${encodeURIComponent(text)}`;

function SendAccessForm({ access }: { access: AccessToSend }) {
  const [phone, setPhone] = useState(access.whatsapp ? formatPhone(access.whatsapp) : "");
  const [message, setMessage] = useState(() =>
    accessMessage({ name: access.name, email: access.email, password: access.password, siteUrl: siteConfig.url, storeName: siteConfig.name }),
  );
  const copy = useCopy();
  const digits = onlyDigits(phone);
  const phoneError = digits && !isValidPhone(digits) ? "Número com DDD. Ex.: (84) 98122-5361." : undefined;

  return (
    <div className="space-y-4">
      <TextField
        label="WhatsApp"
        name="phone"
        inputMode="tel"
        autoComplete="off"
        placeholder="(84) 98122-5361"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        error={phoneError}
        hint="Sem número, o WhatsApp abre para você escolher a conversa."
      />
      <TextAreaField label="Mensagem" name="message" rows={9} value={message} onChange={(event) => setMessage(event.target.value)} />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={() => void copy(message, "Mensagem copiada.")}>
          <Copy aria-hidden className="size-4" /> Copiar mensagem
        </Button>
        <a
          href={phoneError ? undefined : whatsappLink(digits, message)}
          target="_blank"
          rel="noreferrer"
          aria-disabled={phoneError ? true : undefined}
          className={cn(buttonClasses({}), "bg-[#25d366] text-ink shadow-none hover:bg-[#3be07a]", phoneError && "pointer-events-none opacity-50")}
        >
          <MessageCircle aria-hidden className="size-4" /> Enviar pelo WhatsApp
        </a>
      </div>
    </div>
  );
}

/** Mensagem pronta com link, e-mail e senha provisória, editável antes de mandar. */
export function SendAccessDialog({ access, onClose }: { access: AccessToSend | null; onClose: () => void }) {
  return (
    <Modal
      open={access !== null}
      title="Mandar o acesso"
      description={
        access?.password
          ? "A senha nova já vale. Confira a mensagem, ajuste se quiser e mande pelo WhatsApp."
          : "Link e e-mail de acesso, sem mexer na senha. Ajuste se quiser e mande pelo WhatsApp."
      }
      onClose={onClose}
    >
      {access && <SendAccessForm access={access} />}
    </Modal>
  );
}
