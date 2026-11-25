import { Check, Copy, Download, MessageCircle, ShoppingBag, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { siteConfig } from "@/app/config";
import { findAccountBuyer, findDeliveryLogin, listLeads } from "@/application/admin-use-cases";
import type { Account } from "@/domain/account";
import { offerValuesOf } from "@/domain/account-offer";
import { EMPTY_DELIVERY_LOGIN, hasProfileLogin, type DeliveryLogin } from "@/domain/delivery-login";
import { isOpenLead, type Lead } from "@/domain/lead";
import { fillTemplate } from "@/domain/message-template";
import type { Order, OrderStatus } from "@/domain/order";
import { Button, buttonClasses } from "@/ui/components/Button";
import { TextField } from "@/ui/components/form/Fields";
import { SelectField, TextAreaField } from "../components/FormControls";
import { cn } from "@/ui/lib/cn";
import { useAdminQuery, useMessageTemplates } from "../hooks";
import { buyerMessage } from "../lib/messages";
import { INTERNATIONAL_WHATSAPP_PATTERN, isInternationalWhatsapp, normalizeWhatsapp } from "@/domain/whatsapp-number";
import { firstNameOf, formatPhone, whatsappChatUrl } from "../lib/whatsapp";

/** Vazio (escolher no WhatsApp), número do Brasil com DDD ou número de fora com "+" e o código do país. */
const isValidPhone = (phone: string) =>
  phone === "" ||
  (isInternationalWhatsapp(phone) ? INTERNATIONAL_WHATSAPP_PATTERN.test(phone) : phone.length >= 10 && phone.length <= 13);

/** Sem nome, a saudação do modelo continua natural ("Oi, tudo bem!"). */
const GREETING_FALLBACK = "tudo bem";

const COPIED_MS = 2000;

/** Sem número, o WhatsApp abre a lista de conversas para escolher para quem mandar. */
function whatsappLink(phone: string, text: string): string {
  return phone ? whatsappChatUrl(phone, text) : `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** Para quem comprou vão as orientações do pedido; para os outros, a oferta da conta; para o grupo, o anúncio. */
export type MessageMode = "buyer" | "offer" | "community";

const BUYER_STATUS_LABEL: Record<Exclude<OrderStatus, "canceled">, string> = {
  awaiting_payment: "aguardando pagamento",
  paid: "pago, falta entregar",
  delivered: "entregue",
};

const MODE_LABEL: Record<MessageMode, string> = {
  buyer: "Orientações ao comprador",
  offer: "Oferecer a conta",
  community: "Postar na comunidade",
};

function useShareMessage(account: Account, name: string, mode: MessageMode, buyer: Order | null, access: DeliveryLogin) {
  const templates = useMessageTemplates();
  const generated = useMemo(() => {
    if (mode === "buyer" && buyer) return buyerMessage(templates, buyer, access);
    if (mode === "community") {
      return fillTemplate(templates.community_post, offerValuesOf(account, { recipientName: "", siteUrl: siteConfig.url, storeName: siteConfig.name }));
    }
    return fillTemplate(
      templates.account_offer,
      offerValuesOf(account, { recipientName: name ? firstNameOf(name) : GREETING_FALLBACK, siteUrl: siteConfig.url, storeName: siteConfig.name }),
    );
  }, [templates, account, name, mode, buyer, access]);
  const [edited, setEdited] = useState<string | null>(null);
  return { message: edited ?? generated, edit: setEdited, reset: () => setEdited(null), isEdited: edited !== null };
}

function BuyerSummary({ buyer }: { buyer: Order }) {
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
    </div>
  );
}

function ModeSwitch({ modes, mode, onModeChange }: { modes: readonly MessageMode[]; mode: MessageMode; onModeChange: (mode: MessageMode) => void }) {
  return (
    <div role="radiogroup" aria-label="Que mensagem enviar" className="flex flex-wrap gap-1 rounded-2xl border border-line bg-ink/60 p-1 text-xs sm:inline-flex sm:rounded-full">
      {modes.map((value) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={mode === value}
          onClick={() => onModeChange(value)}
          className={cn("rounded-full px-3 py-1.5", mode === value ? "bg-white/[0.1] font-semibold text-white" : "text-mist hover:text-white")}
        >
          {MODE_LABEL[value]}
        </button>
      ))}
    </div>
  );
}

/** Foto principal da conta para anexar no grupo (o WhatsApp não leva imagem pelo link). */
const photoOf = (account: Account) => account.images[0] ?? account.avatarUrl ?? null;

async function downloadPhoto(account: Account, url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Foto indisponível (${response.status})`);
  const blob = await response.blob();
  const extension = blob.type.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${account.handle.replace(/^@/, "")}.${extension}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
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
  /** E-mail da conta e login do perfil, que entram na mensagem de entrega. */
  access: DeliveryLogin;
  /** Modo de abertura; sem ele, comprador (se houver) ou oferta. */
  initialMode?: MessageMode;
  onClose: () => void;
}

const TITLE: Record<MessageMode, string> = {
  buyer: "Enviar ao comprador",
  offer: "Enviar pelo WhatsApp",
  community: "Postar na comunidade",
};

function ShareForm({ account, buyer, access, initialMode, onClose }: ShareFormProps) {
  const titleId = useId();
  const [name, setName] = useState(buyer?.customer.name ?? "");
  const [phone, setPhone] = useState(buyer?.customer.whatsapp ? formatPhone(buyer.customer.whatsapp) : "");
  const [mode, setMode] = useState<MessageMode>(initialMode ?? (buyer ? "buyer" : "offer"));
  const [copied, setCopied] = useState(false);
  const [photoState, setPhotoState] = useState<"idle" | "loading" | "error">("idle");
  const offer = useShareMessage(account, name, mode, buyer, access);
  const buyerMode = mode === "buyer" && buyer !== null;
  const community = mode === "community";
  const modes: MessageMode[] = buyer ? ["buyer", "offer", "community"] : ["offer", "community"];
  const digits = community ? "" : normalizeWhatsapp(phone);
  const phoneError = isValidPhone(digits) ? undefined : "Número inválido. Use DDD + número (ex.: 11 91234-5678) ou + e o código do país.";
  const photo = photoOf(account);

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

  const savePhoto = async () => {
    if (!photo) return;
    setPhotoState("loading");
    try {
      await downloadPhoto(account, photo);
      setPhotoState("idle");
    } catch (error) {
      console.error("Não foi possível baixar a foto", error);
      setPhotoState("error");
    }
  };

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id={titleId} className="font-display text-lg font-semibold">
            {TITLE[buyerMode ? "buyer" : community ? "community" : "offer"]}
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
        {buyer && <BuyerSummary buyer={buyer} />}
        <ModeSwitch
          modes={modes}
          mode={mode}
          onModeChange={(next) => {
            setMode(next);
            offer.reset();
          }}
        />
        {community ? (
          <p className="rounded-xl border border-electric/25 bg-electric/[0.06] px-4 py-3 text-xs leading-relaxed text-fog">
            O WhatsApp não deixa sistema postar sozinho em grupo. Toque em <strong className="text-white">Abrir no WhatsApp</strong>, escolha o grupo da
            comunidade e envie. Para ir com foto, baixe a foto antes e anexe junto.
          </p>
        ) : (
          <>
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
          </>
        )}
        <TextAreaField
          label="Mensagem"
          name="message"
          rows={9}
          value={offer.message}
          onChange={(event) => offer.edit(event.target.value)}
          hint={`O texto padrão fica em WhatsApp > Mensagens, no modelo “${messageModelOf(mode, buyer)}”.`}
        />
        {buyerMode && buyer && buyer.status !== "awaiting_payment" && !access.email && !hasProfileLogin(access.profile) && (
          <p className="rounded-xl border border-amber-300/30 bg-amber-300/[0.06] px-4 py-3 text-xs text-amber-100">
            Esta conta ainda não tem login cadastrado. Preencha em “Acesso da conta”, na ficha dela, para irem na mensagem.
          </p>
        )}
        {photoState === "error" && (
          <p role="alert" className="text-xs font-medium text-[#ff7a7a]">
            Não foi possível baixar a foto. Tente de novo ou salve pela página da conta.
          </p>
        )}
        {offer.isEdited && (
          <button type="button" onClick={offer.reset} className="text-xs text-electric-soft underline-offset-4 hover:underline">
            Voltar para o texto padrão
          </button>
        )}
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
        {community && photo && (
          <Button variant="secondary" onClick={() => void savePhoto()} disabled={photoState === "loading"}>
            <Download aria-hidden className="size-4" /> {photoState === "loading" ? "Baixando…" : "Baixar foto"}
          </Button>
        )}
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
  if (mode === "community") return "Postar na comunidade";
  if (mode === "offer" || !buyer) return "Oferecer conta";
  return buyer.status === "awaiting_payment" ? "Pedido recebido" : "Conta entregue";
}

/** Busca quem comprou a conta (e o login dela) antes de montar o formulário, para ele já abrir preenchido. */
function ShareContent({ account, initialMode, onClose }: { account: Account; initialMode?: MessageMode; onClose: () => void }) {
  const buyer = useAdminQuery((deps) => findAccountBuyer(deps, account.id), `account-buyer:${account.id}`);
  const access = useAdminQuery((deps) => findDeliveryLogin(deps, account.id), `account-access-share:${account.id}`);
  if (buyer.status === "loading" || access.status === "loading") {
    return (
      <p role="status" className="py-10 text-center text-sm text-mist">
        Carregando…
      </p>
    );
  }
  if (buyer.status === "error") console.error("Não foi possível buscar o comprador da conta", buyer.error);
  if (access.status === "error") console.error("Não foi possível buscar o login da conta", access.error);
  return (
    <ShareForm
      account={account}
      buyer={buyer.status === "success" ? buyer.data : null}
      access={access.status === "success" ? access.data : EMPTY_DELIVERY_LOGIN}
      initialMode={initialMode}
      onClose={onClose}
    />
  );
}

/** Janela para mandar os dados da conta para quem quer comprar ou orientar quem já comprou. `<dialog>` nativo: Esc fecha e o foco volta. */
export function ShareAccountDialog({ account, initialMode, onClose }: { account: Account | null; initialMode?: MessageMode; onClose: () => void }) {
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
      {account && <ShareContent key={account.id} account={account} initialMode={initialMode} onClose={onClose} />}
    </dialog>
  );
}
