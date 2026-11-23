import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getWhatsAppSettings, listWhatsAppContacts } from "@/application/admin-use-cases";
import { ErrorState } from "@/ui/components/StateViews";
import { cn } from "@/ui/lib/cn";
import { LoadingBlock } from "../components/AdminUi";
import { useAdminQuery, usePolling } from "../hooks";
import { ConversationList, type ConversationFilter, type KindFilter } from "./ConversationList";
import { ConversationView } from "./ConversationView";
import { SimulateCustomerDialog } from "./SimulateCustomerDialog";

const REFRESH_MS = 10_000;
export const CONTACT_PARAM = "c";

interface InboxPanelProps {
  simulating: boolean;
  onSimulatingChange: (open: boolean) => void;
  /** Avisa a página quando uma conversa abre: no celular o topo sai para as mensagens terem espaço. */
  onOpenChange: (open: boolean) => void;
}

/** WhatsApp > Conversas: lista à esquerda, conversa à direita (no celular, uma tela de cada vez). */
export function InboxPanel({ simulating, onSimulatingChange, onOpenChange }: InboxPanelProps) {
  const contacts = useAdminQuery(listWhatsAppContacts, "whatsapp-contacts");
  const settings = useAdminQuery(getWhatsAppSettings, "whatsapp-settings");
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<ConversationFilter>("all");
  const [kind, setKind] = useState<KindFilter>("any");

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
  const open = selected !== null;
  useEffect(() => onOpenChange(open), [open, onOpenChange]);

  return (
    <>
      {contacts.status === "loading" && <LoadingBlock />}
      {contacts.status === "error" && <ErrorState message={contacts.error.message} onRetry={contacts.reload} />}
      {list && (
        <div
          className={cn(
            "grid grid-cols-[minmax(0,1fr)] overflow-hidden rounded-xl border border-line bg-surface/40 md:h-[calc(100dvh-19rem)] md:min-h-[28rem] md:grid-cols-[minmax(17rem,21rem)_minmax(0,1fr)]",
            selected && "max-md:h-[calc(100dvh-10.5rem)]",
          )}
        >
          <div className={cn("min-h-0 md:border-r md:border-line", selected && "max-md:hidden")}>
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
              <ConversationView key={selected.id} contact={selected} mode={mode} onChanged={reloadContacts} onBack={() => select(null)} />
            ) : (
              <div className="grid h-full place-items-center bg-night px-6 text-center">
                <div>
                  <p className="text-sm font-medium text-fog">Nenhuma conversa aberta</p>
                  <p className="mt-1 text-xs text-mist">Escolha uma na lista. As que esperam você têm o número rosa.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <SimulateCustomerDialog
        open={simulating}
        onClose={() => onSimulatingChange(false)}
        onDone={(contactId) => {
          onSimulatingChange(false);
          reloadContacts();
          select(contactId);
        }}
      />
    </>
  );
}
