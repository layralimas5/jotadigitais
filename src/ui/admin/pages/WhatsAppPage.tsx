import { FlaskConical } from "lucide-react";
import { useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getWhatsAppSettings, listWhatsAppContacts } from "@/application/admin-use-cases";
import { Button } from "@/ui/components/Button";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { cn } from "@/ui/lib/cn";
import { LoadingBlock, PageHeader } from "../components/AdminUi";
import { useAdminQuery, usePolling } from "../hooks";
import { ConversationList, type ConversationFilter, type KindFilter } from "../whatsapp/ConversationList";
import { ConversationView } from "../whatsapp/ConversationView";
import { SimulateCustomerDialog } from "../whatsapp/SimulateCustomerDialog";
import { WhatsAppStatusBar } from "../whatsapp/WhatsAppStatusBar";

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
    <div className="space-y-6">
      <PageHeader
        title="WhatsApp"
        description="Conversas com os clientes. A IA responde sozinha e chama você quando precisa."
        action={
          mode === "test" && (
            <Button type="button" variant="secondary" onClick={() => setSimulating(true)}>
              <FlaskConical aria-hidden className="size-4" /> Simular cliente
            </Button>
          )
        }
      />
      <WhatsAppStatusBar current="conversations" />

      {contacts.status === "loading" && <LoadingBlock />}
      {contacts.status === "error" && <ErrorState message={contacts.error.message} onRetry={contacts.reload} />}
      {list && (
        <div className="grid gap-4 md:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)] md:items-start">
          {/* No celular é uma tela de cada vez: a lista ou a conversa aberta. */}
          <div className={cn(selected && "max-md:hidden")}>
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
          <div className={cn(!selected && "max-md:hidden")}>
            {selected ? (
              <ConversationView key={selected.id} contact={selected} mode={mode} onChanged={reloadContacts} onBack={() => select(null)} />
            ) : (
              <EmptyState title="Escolha uma conversa" description="As que estão com você aparecem com o número rosa." />
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
