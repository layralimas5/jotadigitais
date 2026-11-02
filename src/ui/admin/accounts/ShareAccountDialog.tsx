import { Check, Copy, MessageCircle, ShoppingBag, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { siteConfig } from "@/app/config";
import { findAccountBuyer, listLeads } from "@/application/admin-use-cases";
import type { Account } from "@/domain/account";
import { offerValuesOf } from "@/domain/account-offer";
import { isOpenLead, type Lead } from "@/domain/lead";
import { fillTemplate } from "@/domain/message-template";
import type { Order, OrderStatus } from "@/domain/order";
import { Button, buttonClasses } from "@/ui/components/Button";
import { TextField } from "@/ui/components/form/Fields";
import { SelectField, TextAreaField } from "../components/FormControls";
import { cn } from "@/ui/lib/cn";
import { useAdminQuery, useMessageTemplates } from "../hooks";
import { buyerMessage } from "../lib/messages";
import { firstNameOf, formatPhone, whatsappChatUrl } from "../lib/whatsapp";

const onlyDigits = (value: string) => value.replace(/\D/g, "");
const isValidPhone = (digits: string) => digits === "" || (digits.length >= 10 && digits.length <= 13);

/** Sem nome, a saudação do modelo continua natural ("Oi, tudo bem!"). */
const GREETING_FALLBACK = "tudo bem";

const COPIED_MS = 2000;

/** Sem número, o WhatsApp abre a lista de conversas para escolher para quem mandar. */
function whatsappLink(phone: string, text: string): string {
  return phone ? whatsappChatUrl(phone, text) : `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** Para quem comprou vão as orientações do pedido; para os outros, a oferta da conta. */
type MessageMode = "buyer" | "offer";

const BUYER_STATUS_LABEL: Record<Exclude<OrderStatus, "canceled">, string> = {
  awaiting_payment: "aguardando pagamento",
  paid: "pago, falta entregar",
  delivered: "entregue",
};

const MODE_OPTIONS: readonly (readonly [MessageMode, string])[] = [
  ["buyer", "Orientações ao comprador"],
  ["offer", "Oferecer a conta"],
];

function useShareMessage(account: Account, name: string, mode: MessageMode, buyer: Order | null) {
  const templates = useMessageTemplates();
  const generated = useMemo(() => {
    if (mode === "buyer" && buyer) return buyerMessage(templates, buyer);
    return fillTemplate(
      templates.account_offer,
      offerValuesOf(account, { recipientName: name ? firstNameOf(name) : GREETING_FALLBACK, siteUrl: siteConfig.url, storeName: siteConfig.name }),
    );
  }, [templates, account, name, mode, buyer]);
  const [edited, setEdited] = useState<string | null>(null);
  return { message: edited ?? generated, edit: setEdited, reset: () => setEdited(null), isEdited: edited !== null };
}

function BuyerSummary({ buyer, mode, onModeChange }: { buyer: Order; mode: MessageMode; onModeChange: (mode: MessageMode) => void }) {
  const status = buyer.status === "canceled" ? null : BUYER_STATUS_LABEL[buyer.status];
  return (
    <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.06] p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-white">
        <ShoppingBag aria-hidden className="size-4 text-emerald-300" /> Comprada por {buyer.customer.name}
      </p>
      <p className="mt-1 text-xs text-mist">
        Pedido <span className="font-mono text-fog">{buyer.code}</span>
        {status && ` · ${status}`}
      </p>
      <div role="radiogroup" aria-label="Que mensagem enviar" className="mt-3 inline-flex rounded-full border border-line bg-ink/60 p-1 text-xs">
        {MODE_OPTIONS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={mode === value}
            onClick={() => onModeChange(value)}
            className={cn(
              "rounded-full px-3 py-1.5",
              mode === value ? "bg-white/[0.1] font-semibold text-white" : "text-mist hover:text-white",
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function LeadPicker({ onPick }: { onPick: (lead: Lead) => void }) {
  const leads = useAdminQuery(listLeads, "share-leads");
  const options = leads.status === "success" ? leads.data.filter((lead) => lead.whatsapp && isOpenLead(lead)) : [];
  if (options.length === 0) return null;
  return (
    <SelectField
      label="Contato do CRM (opcional)"
      name="lead"
      defaultValue=""
      options={[{ value: "", label: "Escolher alguém do CRM" }, ...options.map((lead) => ({ value: lead.id, label: lead.name }))]}
      onChange={(event) => {
        const lead = options.find((item) => item.id === event.target.value);
        if (lead) onPick(lead);
      }}
    />
  );
}

interface ShareFormProps {
  account: Account;
  /** Pedido de quem comprou a conta pelo site: nome, WhatsApp e mensagem já vêm dele. */
  buyer: Order | null;
  onClose: () => void;
}

function ShareForm({ account, buyer, onClose }: ShareFormProps) {
  const titleId = useId();
  const [name, setName] = useState(buyer?.customer.name ?? "");
  const [phone, setPhone] = useState(buyer?.customer.whatsapp ? formatPhone(buyer.customer.whatsapp) : "");
  const [mode, setMode] = useState<MessageMode>(buyer ? "buyer" : "offer");
  const [copied, setCopied] = useState(false);
  const offer = useShareMessage(account, name, mode, buyer);
  const buyerMode = mode === "buyer" && buyer !== null;
  const digits = onlyDigits(phone);
  const phoneError = isValidPhone(digits) ? undefined : "Número inválido. Use DDD + número, ex.: 11 91234-5678.";

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(offer.message);
      setCopied(true);
    } catch (error) {
      console.error("Não foi possível copiar", error);
    }
  };

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id={titleId} className="font-display text-lg font-semibold">
            {buyerMode ? "Enviar ao comprador" : "Enviar pelo WhatsApp"}
          </h2>
          <p className="mt-1 text-sm text-mist">
            {account.displayName} <span className="text-fog">{account.handle}</span>
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar" className="grid size-9 shrink-0 place-items-center rounded-full text-mist hover:bg-white/[0.06] hover:text-white">
          <X aria-hidden className="size-4" />
        </button>
      </div>

      <div className="mt-5 space-y-4">
        {buyer && (
          <BuyerSummary
            buyer={buyer}
            mode={mode}
            onModeChange={(next) => {
              setMode(next);
              offer.reset();
            }}
          />
        )}
        {!buyerMode && (
          <LeadPicker
            onPick={(lead) => {
              setName(lead.name);
              setPhone(lead.whatsapp ?? "");
            }}
          />
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Nome de quem recebe" name="recipientName" autoComplete="off" value={name} onChange={(event) => setName(event.target.value)} />
          <TextField
            label="WhatsApp"
            name="recipientPhone"
            type="tel"
            inputMode="tel"
            placeholder="(11) 91234-5678"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            error={phoneError}
            hint="Vazio: você escolhe a conversa no WhatsApp."
          />
        </div>
        <TextAreaField
          label="Mensagem"
          name="message"
          rows={9}
          value={offer.message}
          onChange={(event) => offer.edit(event.target.value)}
          hint={`O texto padrão fica em Automação, no modelo “${messageModelOf(mode, buyer)}”.`}
        />
        {offer.isEdited && (
          <button type="button" onClick={offer.reset} className="text-xs text-electric-soft underline-offset-4 hover:underline">
            Voltar para o texto padrão
          </button>
        )}
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={() => void copy()}>
          {copied ? <Check aria-hidden className="size-4 text-emerald-300" /> : <Copy aria-hidden className="size-4" />}
          {copied ? "Copiado" : "Copiar texto"}
        </Button>
        <a
          href={phoneError ? undefined : whatsappLink(digits, offer.message)}
          target="_blank"
          rel="noreferrer"
          aria-disabled={phoneError ? true : undefined}
          onClick={(event) => {
            if (phoneError) event.preventDefault();
            else onClose();
          }}
          className={buttonClasses({ className: "bg-[#25d366] text-ink shadow-none hover:bg-[#3be07a] hover:shadow-none aria-disabled:opacity-50" })}
        >
          <MessageCircle aria-hidden className="size-4" /> Abrir no WhatsApp
        </a>
      </div>
    </>
  );
}

function messageModelOf(mode: MessageMode, buyer: Order | null): string {
  if (mode === "offer" || !buyer) return "Oferecer conta";
  return buyer.status === "awaiting_payment" ? "Pedido recebido" : "Conta entregue";
}

/** Busca quem comprou a conta antes de montar o formulário, para ele já abrir preenchido. */
function ShareContent({ account, onClose }: { account: Account; onClose: () => void }) {
  const buyer = useAdminQuery((deps) => findAccountBuyer(deps, account.id), `account-buyer:${account.id}`);
  if (buyer.status === "loading") {
    return (
      <p role="status" className="py-10 text-center text-sm text-mist">
        Carregando…
      </p>
    );
  }
  if (buyer.status === "error") console.error("Não foi possível buscar o comprador da conta", buyer.error);
  return <ShareForm account={account} buyer={buyer.status === "success" ? buyer.data : null} onClose={onClose} />;
}

/** Janela para mandar os dados da conta para quem quer comprar ou orientar quem já comprou. `<dialog>` nativo: Esc fecha e o foco volta. */
export function ShareAccountDialog({ account, onClose }: { account: Account | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (account && !dialog.open) dialog.showModal();
    if (!account && dialog.open) dialog.close();
  }, [account]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label="Enviar conta pelo WhatsApp"
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(36rem,calc(100vw-2rem))] overflow-y-auto rounded-3xl border border-line-strong bg-surface p-6 text-white backdrop:bg-black/70 backdrop:backdrop-blur-sm max-sm:mb-0 max-sm:max-h-[92dvh] max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))] max-sm:open:animate-[sheet-up_0.25s_var(--ease-out-expo)]"
    >
      {account && <ShareContent key={account.id} account={account} onClose={onClose} />}
    </dialog>
  );
}
