import { FlaskConical, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { getWhatsAppSettings, listWhatsAppMessages, setWhatsAppAutoDelivery } from "@/application/admin-use-cases";
import {
  WHATSAPP_KIND_LABEL,
  WHATSAPP_STATUS_LABEL,
  type WhatsAppMessage,
  type WhatsAppMessageStatus,
  type WhatsAppSettings,
} from "@/domain/whatsapp";
import { Button } from "@/ui/components/Button";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { cn } from "@/ui/lib/cn";
import { InlineError, LoadingBlock } from "../components/AdminUi";
import { ToggleField } from "../components/FormControls";
import { WhatsAppBubble } from "../delivery/WhatsAppBubble";
import { useAdminQuery, useMutation } from "../hooks";
import { firstNameOf, formatPhone } from "../lib/whatsapp";
import { useToast } from "../toast";
import { WhatsAppFollowUpsSection } from "./WhatsAppFollowUpsSection";

const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

const STATUS_TONE: Record<WhatsAppMessageStatus, string> = {
  queued: "border-line-strong text-fog",
  sending: "border-line-strong text-fog",
  test: "border-amber-300/40 text-amber-200",
  sent: "border-emerald-400/40 text-emerald-300",
  failed: "border-alert/50 text-[#ff7a7a]",
  canceled: "border-line-strong text-mist",
};

/** Mensagens do mesmo disparo (aviso de pagamento e o acesso de cada conta) ficam juntas, na ordem em que saem. */
interface DeliveryGroup {
  key: string;
  messages: WhatsAppMessage[];
}

function groupByDispatch(messages: readonly WhatsAppMessage[]): DeliveryGroup[] {
  const groups = new Map<string, WhatsAppMessage[]>();
  for (const message of messages) {
    const key = `${message.toPhone}|${message.sentAt ?? message.id}`;
    groups.set(key, [...(groups.get(key) ?? []), message]);
  }
  return [...groups].map(([key, items]) => ({
    key,
    messages: [...items].sort((a, b) => (a.kind === b.kind ? a.createdAt.localeCompare(b.createdAt) : a.kind === "payment_confirmed" ? -1 : 1)),
  }));
}

function ModeNotice({ mode }: { mode: WhatsAppSettings["mode"] }) {
  const live = mode === "live";
  const Icon = live ? ShieldCheck : FlaskConical;
  return (
    <div className={cn("flex gap-4 rounded-3xl border p-5", live ? "border-emerald-400/30 bg-emerald-400/[0.05]" : "border-amber-300/30 bg-amber-300/[0.05]")}>
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-2xl", live ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-300/15 text-amber-200")}>
        <Icon aria-hidden className="size-5" />
      </span>
      <div className="text-sm">
        <p className="font-semibold text-white">{live ? "Conectado ao WhatsApp oficial" : "Modo teste"}</p>
        <p className="mt-1 leading-relaxed text-mist">
          {live
            ? "Quando o pagamento confirma, o cliente recebe o aviso com o botão “Receber meu acesso”. O acesso sai assim que ele toca."
            : "Nada é enviado ao cliente ainda. Cada pedido pago aparece aqui com a mensagem exata que sairia, com as senhas escondidas. Quando o número oficial estiver conectado, o envio passa a ser de verdade."}
        </p>
      </div>
    </div>
  );
}

function AutoDeliveryToggle({ initial }: { initial: WhatsAppSettings }) {
  const toast = useToast();
  const [enabled, setEnabled] = useState(initial.autoDelivery);
  const save = useMutation(setWhatsAppAutoDelivery);

  const change = async (next: boolean) => {
    setEnabled(next);
    const saved = await save.run(next);
    if (!saved) {
      setEnabled(!next);
      toast.show("Não foi possível salvar. Tente de novo.", "error");
      return;
    }
    toast.show(next ? "Entrega automática ligada." : "Entrega automática desligada. Entregue pelo card de Pedidos.");
  };

  return (
    <div className="space-y-2">
      <ToggleField
        name="auto_delivery"
        label="Entregar o acesso sozinho quando o pagamento confirmar"
        description="Vale para Pix, cartão e para quando você confirma o pagamento no painel."
        checked={enabled}
        onChange={(next) => void change(next)}
      />
      {save.error && <InlineError message={save.error.message} />}
    </div>
  );
}

function MessageItem({ message }: { message: WhatsAppMessage }) {
  return (
    <li className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium text-fog">{WHATSAPP_KIND_LABEL[message.kind]}</span>
        {message.kind !== "payment_confirmed" && message.orderCode && <span className="font-mono text-mist">{message.orderCode}</span>}
        <span className={cn("rounded-full border px-2 py-0.5 font-medium", STATUS_TONE[message.status])}>
          {WHATSAPP_STATUS_LABEL[message.status]}
        </span>
      </div>
      {message.body && <WhatsAppBubble text={message.body} />}
      {message.error && <p className="text-xs text-[#ff7a7a]">{message.error}</p>}
    </li>
  );
}

function DeliveryGroupCard({ group }: { group: DeliveryGroup }) {
  const head = group.messages[0]!;
  const when = head.sentAt ?? head.createdAt;
  return (
    <article className="rounded-3xl border border-line bg-surface/60 p-5 sm:p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-sm font-semibold text-white">
          {head.customerName ? firstNameOf(head.customerName) : "Cliente"} · {formatPhone(head.toPhone)}
        </h3>
        <p className="text-xs text-mist">
          {head.orderCode && <span className="font-mono">{head.orderCode} · </span>}
          <time dateTime={when}>{dateTime.format(new Date(when))}</time>
        </p>
      </header>
      <ol className="mt-4 space-y-4">
        {group.messages.map((message) => (
          <MessageItem key={message.id} message={message} />
        ))}
      </ol>
    </article>
  );
}

function DeliveryLog() {
  const log = useAdminQuery(listWhatsAppMessages, "whatsapp-messages");
  const [refreshing, setRefreshing] = useState(false);

  const loaded = log.status === "success" ? log.data : null;
  const failed = log.status === "error" ? log.error : null;

  // A lista anterior continua na tela durante o "Atualizar"; o giro para quando a resposta nova chega.
  useEffect(() => {
    setRefreshing(false);
  }, [loaded, failed]);

  const refresh = () => {
    setRefreshing(true);
    log.reload();
  };

  return (
    <section aria-labelledby="whatsapp-log-title" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id="whatsapp-log-title" className="font-display text-base font-semibold text-white">
          Últimos envios
        </h2>
        <Button type="button" variant="ghost" onClick={refresh} disabled={refreshing}>
          <RefreshCw aria-hidden className={cn("size-4", refreshing && "motion-safe:animate-spin")} /> Atualizar
        </Button>
      </div>
      {log.status === "loading" && !refreshing && <LoadingBlock />}
      {log.status === "error" && <ErrorState message={log.error.message} onRetry={log.reload} />}
      {log.status === "success" &&
        (log.data.length === 0 ? (
          <EmptyState title="Nenhum envio ainda" description="Quando um pedido for pago, ou um lembrete sair, a mensagem aparece aqui." />
        ) : (
          <div className="space-y-4">
            {groupByDispatch(log.data).map((group) => (
              <DeliveryGroupCard key={group.key} group={group} />
            ))}
          </div>
        ))}
    </section>
  );
}

export function WhatsAppDeliveryPanel() {
  const settings = useAdminQuery(getWhatsAppSettings, "whatsapp-settings");
  return (
    <div className="space-y-6">
      {settings.status === "loading" && <LoadingBlock />}
      {settings.status === "error" && <ErrorState message={settings.error.message} onRetry={settings.reload} />}
      {settings.status === "success" && (
        <>
          <ModeNotice mode={settings.data.mode} />
          <AutoDeliveryToggle initial={settings.data} />
          <WhatsAppFollowUpsSection initial={settings.data} />
        </>
      )}
      <DeliveryLog />
    </div>
  );
}
