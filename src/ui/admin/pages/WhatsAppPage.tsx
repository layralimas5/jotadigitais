import { FlaskConical } from "lucide-react";
import { useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  getWhatsAppSettings,
  listWhatsAppContacts,
} from "@/application/admin-use-cases";
import { ErrorState } from "@/ui/components/StateViews";
import { cn } from "@/ui/lib/cn";
import { LoadingBlock, PageHeader } from "../components/AdminUi";
import { useAdminQuery, usePolling } from "../hooks";
import {
  ConversationList,
  type ConversationFilter,
  type KindFilter,
} from "../whatsapp/ConversationList";
import { ConversationView } from "../whatsapp/ConversationView";
import { SimulateCustomerDialog } from "../whatsapp/SimulateCustomerDialog";
import { WhatsAppStatusBar } from "../whatsapp/WhatsAppStatusBar";
import { compactButton } from "../whatsapp/styles";

const REFRESH_MS = 10_000;
const CONTACT_PARAM = "c";

export default function WhatsAppPage() {
  const contacts = useAdminQuery(listWhatsAppContacts, "whatsapp-contacts");
  const settings = useAdminQuery(getWhatsAppSettings, "whatsapp-settings");
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<ConversationFilter>("all");
  const [kind, setKind] = useState<KindFilter>("any");
  const [simulating, setSimulating] = useState(false);

  const reloadContacts = contacts.reload;
  const reloadVisible = useCallback(() => {
    if (document.visibilityState === "visible") reloadContacts();
  }, [reloadContacts]);
  usePolling(reloadVisible, REFRESH_MS);

  const selectedId = params.get(CONTACT_PARAM);
  const select = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set(CONTACT_PARAM, id);
    else next.delete(CONTACT_PARAM);
    setParams(next);
  };

  const list = contacts.status === "success" ? contacts.data : null;
  const selected = list?.find((contact) => contact.id === selectedId) ?? null;
  const mode = settings.status === "success" ? settings.data.mode : "test";

  return (
    <div className="space-y-5">
      {/* No celular, com uma conversa aberta, o topo sai para as mensagens terem espaço. */}
      <div className={cn("space-y-5", selected && "max-md:hidden")}>
        <PageHeader
          title="WhatsApp"
          description="A IA atende e chama você quando precisa."
          action={
            mode === "test" && (
              <button
                type="button"
                className={compactButton.secondary}
                onClick={() => setSimulating(true)}
              >
                <FlaskConical aria-hidden className="size-3.5" /> Simular
                cliente
              </button>
            )
          }
        />
        <WhatsAppStatusBar current="conversations" />
      </div>

      {contacts.status === "loading" && <LoadingBlock />}
      {contacts.status === "error" && (
        <ErrorState
          message={contacts.error.message}
          onRetry={contacts.reload}
        />
      )}
      {list && (
        <div
          className={cn(
            "grid grid-cols-[minmax(0,1fr)] overflow-hidden rounded-xl border border-line bg-surface/40 md:h-[calc(100dvh-15.5rem)] md:min-h-[28rem] md:grid-cols-[minmax(17rem,21rem)_minmax(0,1fr)]",
            selected && "max-md:h-[calc(100dvh-10.5rem)]",
          )}
        >
          {/* No celular é uma tela de cada vez: a lista ou a conversa aberta. */}
          <div
            className={cn(
              "min-h-0 md:border-r md:border-line",
              selected && "max-md:hidden",
            )}
          >
            <ConversationList
              contacts={list}
              selectedId={selectedId}
              filter={filter}
              kind={kind}
              onFilter={setFilter}
              onKind={setKind}
              onSelect={select}
            />
          </div>
          <div className={cn("min-h-0", !selected && "max-md:hidden")}>
            {selected ? (
              <ConversationView
                key={selected.id}
                contact={selected}
                mode={mode}
                onChanged={reloadContacts}
                onBack={() => select(null)}
              />
            ) : (
              <div className="grid h-full place-items-center bg-night px-6 text-center">
                <div>
                  <p className="text-sm font-medium text-fog">
                    Nenhuma conversa aberta
                  </p>
                  <p className="mt-1 text-xs text-mist">
                    Escolha uma na lista. As que esperam você têm o número rosa.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <SimulateCustomerDialog
        open={simulating}
        onClose={() => setSimulating(false)}
        onDone={(contactId) => {
          setSimulating(false);
          reloadContacts();
          select(contactId);
        }}
      />
    </div>
  );
}
