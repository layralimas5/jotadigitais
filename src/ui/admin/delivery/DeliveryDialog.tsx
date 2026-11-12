import { Check, Copy, MessageCircle, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { findDeliveryLogin } from "@/application/admin-use-cases";
import { EMPTY_DELIVERY_LOGIN, type DeliveryLogin } from "@/domain/delivery-login";
import type { Order } from "@/domain/order";
import { Button, buttonClasses } from "@/ui/components/Button";
import { ErrorState } from "@/ui/components/StateViews";
import { cn } from "@/ui/lib/cn";
import { InlineError } from "../components/AdminUi";
import { useAdminQuery } from "../hooks";
import { deliveryMessage } from "../lib/messages";
import { firstNameOf, whatsappChatUrl } from "../lib/whatsapp";
import { MessageCards } from "./MessageCards";
import { MessageEditor } from "./MessageEditor";
import { useDeliveryMessages, type MessageChoice, type MessageOption } from "./use-delivery-messages";
import { WhatsAppBubble } from "./WhatsAppBubble";

const COPIED_MS = 2000;

const LOGIN_FIELDS = [
  { variable: "email", label: "e-mail da conta", has: (login: DeliveryLogin) => login.email !== null },
  { variable: "senha", label: "senha do e-mail", has: (login: DeliveryLogin) => Boolean(login.email?.password) },
  { variable: "usuario", label: "usuário do perfil", has: (login: DeliveryLogin) => Boolean(login.profile?.username) },
  { variable: "senha_perfil", label: "senha do perfil", has: (login: DeliveryLogin) => Boolean(login.profile?.password) },
] as const;

/** Variáveis de login que a mensagem usa e a ficha da conta ainda não tem: essas linhas saem do texto. */
const missingLoginOf = (body: string, login: DeliveryLogin) =>
  LOGIN_FIELDS.filter((field) => body.includes(`{${field.variable}}`) && !field.has(login)).map((field) => field.label);

function MissingLoginNotice({ missing, accountId }: { missing: readonly string[]; accountId: string | null }) {
  if (missing.length === 0) return null;
  return (
    <p className="rounded-xl border border-amber-300/30 bg-amber-300/[0.06] px-4 py-3 text-xs leading-relaxed text-amber-100">
      Falta na ficha da conta: {missing.join(", ")}. Essas linhas saem da mensagem.{" "}
      {accountId && (
        <Link to={`/admin/contas/${accountId}`} className="font-medium text-electric-soft underline-offset-4 hover:underline">
          Preencher na ficha
        </Link>
      )}
    </p>
  );
}

function useCopied() {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch (error) {
      console.error("Não foi possível copiar", error);
    }
  };
  return { copied, copy };
}

interface DeliveryFormProps {
  order: Order;
  login: DeliveryLogin;
  messages: ReturnType<typeof useDeliveryMessages>;
  titleId: string;
  onClose: () => void;
}

function DeliveryForm({ order, login, messages, titleId, onClose }: DeliveryFormProps) {
  const { options } = messages;
  const [selected, setSelected] = useState<MessageChoice>("default");
  /** Texto em edição; nulo fora do editor. */
  const [draft, setDraft] = useState<string | null>(null);
  /** Texto editado para este envio, sem salvar. */
  const [oneOff, setOneOff] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const { copied, copy } = useCopied();

  const option: MessageOption = options.find((item) => item.choice === selected) ?? options[0]!;
  const body = draft ?? oneOff ?? option.body;
  const text = deliveryMessage(body, order, login);
  const missing = missingLoginOf(body, login);
  const phone = order.customer.whatsapp;

  const finish = (choice: MessageChoice, message: string) => {
    setSelected(choice);
    setDraft(null);
    setOneOff(null);
    setNotice(message);
  };

  const select = (choice: MessageChoice) => {
    messages.resetError();
    setNotice("");
    const next = options.find((item) => item.choice === choice);
    setSelected(choice);
    setOneOff(null);
    if (draft !== null && next) setDraft(next.body);
  };

  const saveNew = async (name: string) => {
    if (draft === null) return;
    const created = await messages.create({ name, body: draft });
    if (created) finish(created.id, `Mensagem “${created.name}” salva nas mensagens prontas.`);
  };

  const saveChanges = async () => {
    if (draft === null || option.choice === "default") return;
    const updated = await messages.update(option.choice, { name: option.name, body: draft });
    if (updated) finish(updated.id, `Mensagem “${updated.name}” atualizada.`);
  };

  const makeDefault = async () => {
    if (draft === null) return;
    const saved = await messages.setDefault(draft);
    if (saved) finish("default", "Mensagem padrão trocada. Ela abre em todos os próximos pedidos.");
  };

  const remove = async () => {
    if (option.choice === "default") return;
    const removed = await messages.remove(option.choice);
    if (removed) finish("default", `Mensagem “${option.name}” apagada.`);
  };

  const editing = draft !== null;

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id={titleId} className="font-display text-lg font-semibold">
            Enviar acesso da conta
          </h2>
          <p className="mt-1 truncate text-sm text-mist">
            {order.customer.name} · <span className="text-fog">{order.accountHandle}</span> · <span className="font-mono">{order.code}</span>
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar" className="grid size-9 shrink-0 place-items-center rounded-full text-mist hover:bg-white/[0.06] hover:text-white">
          <X aria-hidden className="size-4" />
        </button>
      </div>

      <div data-editing={editing ? "" : undefined} className={cn("mt-5 grid gap-4", editing && "lg:grid-cols-2 lg:items-start")}>
        {editing && (
          <MessageEditor
            key={option.choice}
            base={option}
            draft={draft}
            onDraftChange={setDraft}
            canChangeDefault={messages.canChangeDefault}
            pending={messages.pending}
            onSaveNew={(name) => void saveNew(name)}
            onSaveChanges={() => void saveChanges()}
            onMakeDefault={() => void makeDefault()}
            onUseOnce={() => {
              setOneOff(draft);
              setDraft(null);
              setNotice("Texto editado só para este envio.");
            }}
            onDelete={() => void remove()}
            onCancel={() => setDraft(null)}
          />
        )}
        <div className="min-w-0 space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs font-semibold tracking-wide text-mist uppercase">
              Para {firstNameOf(order.customer.name)} · {oneOff !== null && !editing ? "editada só agora" : option.name}
            </p>
          </div>
          <WhatsAppBubble text={text} />
          <MissingLoginNotice missing={missing} accountId={order.accountId} />
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <p className="text-sm font-medium text-fog">Mensagens prontas</p>
        <MessageCards
          options={options}
          selected={selected}
          editing={editing}
          disabled={messages.pending}
          onSelect={select}
          onEdit={() => {
            setNotice("");
            setDraft(editing ? null : (oneOff ?? option.body));
          }}
        />
        {messages.savedError && <p className="text-xs text-amber-200">Não deu para carregar as mensagens salvas. A padrão continua valendo.</p>}
      </div>

      <p role="status" aria-live="polite" className="mt-3 min-h-4 text-xs text-emerald-300">
        {notice}
      </p>
      {messages.error && <InlineError message={messages.error.message} />}

      <div className="mt-4 flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={() => void copy(text)}>
          {copied ? <Check aria-hidden className="size-4 text-emerald-300" /> : <Copy aria-hidden className="size-4" />}
          {copied ? "Copiado" : "Copiar texto"}
        </Button>
        {phone && (
          <a
            href={whatsappChatUrl(phone, text)}
            target="_blank"
            rel="noreferrer"
            onClick={onClose}
            className={buttonClasses({ className: "bg-[#25d366] text-ink shadow-none hover:bg-[#3be07a] hover:shadow-none" })}
          >
            <MessageCircle aria-hidden className="size-4" /> Enviar no WhatsApp
          </a>
        )}
      </div>
    </>
  );
}

/** Busca o login da conta e as mensagens antes de montar o card, para ele já abrir com o texto pronto. */
function DeliveryContent({ order, titleId, onClose }: { order: Order; titleId: string; onClose: () => void }) {
  const { accountId } = order;
  const messages = useDeliveryMessages();
  const login = useAdminQuery(
    (deps) => (accountId ? findDeliveryLogin(deps, accountId) : Promise.resolve(EMPTY_DELIVERY_LOGIN)),
    `delivery-login:${order.code}`,
  );
  if (messages.status === "loading" || login.status === "loading") {
    return (
      <p role="status" className="py-12 text-center text-sm text-mist">
        Buscando o login da conta e as mensagens…
      </p>
    );
  }
  if (messages.loadError) return <ErrorState message={messages.loadError.message} onRetry={messages.retry} />;
  if (login.status === "error") return <ErrorState message="Não deu para buscar o login da conta." onRetry={login.reload} />;
  return <DeliveryForm order={order} login={login.data} messages={messages} titleId={titleId} onClose={onClose} />;
}

/**
 * Card flutuante para mandar o acesso da conta a quem comprou: a mensagem pronta com o login, as mensagens salvas
 * para trocar com um toque e o editor. `<dialog>` nativo: Esc fecha e o foco volta ao botão.
 */
export function DeliveryDialog({ order, onClose }: { order: Order | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (order && !dialog.open) dialog.showModal();
    if (!order && dialog.open) dialog.close();
  }, [order]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby={titleId}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(44rem,calc(100vw-2rem))] lg:has-[[data-editing]]:w-[min(64rem,calc(100vw-2rem))] overflow-y-auto rounded-3xl border border-line-strong bg-surface p-6 text-white backdrop:bg-black/70 backdrop:backdrop-blur-sm max-sm:mb-0 max-sm:max-h-[92dvh] max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:p-4 max-sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))] max-sm:open:animate-[sheet-up_0.25s_var(--ease-out-expo)]"
    >
      {order && <DeliveryContent key={order.code} order={order} titleId={titleId} onClose={onClose} />}
    </dialog>
  );
}
