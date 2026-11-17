import { Bot, UserRound } from "lucide-react";
import { CONTACT_KIND_LABEL, needsStaff, type WhatsAppContact, type WhatsAppContactKind } from "@/domain/whatsapp";
import { EmptyState } from "@/ui/components/StateViews";
import { cn } from "@/ui/lib/cn";
import { FilterChips } from "../components/FilterChips";
import { formatPhone } from "../lib/whatsapp";

export type ConversationFilter = "all" | "waiting" | "ai";
export type KindFilter = WhatsAppContactKind | "any";

const relative = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

/** "agora", "há 5 min", "há 3 h", "12/11". */
export function sinceLabel(iso: string, now = Date.now()): string {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return relative.format(-minutes, "minute");
  if (minutes < 24 * 60) return relative.format(-Math.round(minutes / 60), "hour");
  return shortDate.format(new Date(iso));
}

export function filterContacts(contacts: readonly WhatsAppContact[], filter: ConversationFilter, kind: KindFilter): WhatsAppContact[] {
  return contacts.filter(
    (contact) =>
      (kind === "any" || contact.kind === kind) &&
      (filter === "all" || contact.handler === (filter === "waiting" ? "staff" : "ai")),
  );
}

interface ConversationListProps {
  contacts: readonly WhatsAppContact[];
  selectedId: string | null;
  filter: ConversationFilter;
  kind: KindFilter;
  onFilter: (filter: ConversationFilter) => void;
  onKind: (kind: KindFilter) => void;
  onSelect: (id: string) => void;
}

const KIND_OPTIONS: readonly { value: KindFilter; label: string }[] = [
  { value: "any", label: "Todos" },
  ...(Object.keys(CONTACT_KIND_LABEL) as WhatsAppContactKind[]).map((value) => ({ value, label: CONTACT_KIND_LABEL[value] })),
];

export function ConversationList({ contacts, selectedId, filter, kind, onFilter, onKind, onSelect }: ConversationListProps) {
  const waiting = contacts.filter(needsStaff).length;
  const visible = filterContacts(contacts, filter, kind);
  return (
    <div className="flex min-h-0 flex-col gap-3">
      <FilterChips<ConversationFilter>
        label="Mostrar conversas"
        value={filter}
        onChange={onFilter}
        options={[
          { value: "all", label: "Todas" },
          { value: "waiting", label: waiting ? `Com você (${waiting})` : "Com você" },
          { value: "ai", label: "Com a IA" },
        ]}
      />
      <label className="sr-only" htmlFor="whatsapp-kind-filter">
        Tipo de contato
      </label>
      <select
        id="whatsapp-kind-filter"
        value={kind}
        onChange={(event) => onKind(event.target.value as KindFilter)}
        className="h-10 rounded-xl border border-line-strong bg-ink px-3 text-sm text-white [color-scheme:dark] focus:border-electric focus:outline-none"
      >
        {KIND_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.value === "any" ? "Todos os contatos" : option.label}
          </option>
        ))}
      </select>

      {visible.length === 0 ? (
        <EmptyState
          title={contacts.length === 0 ? "Nenhuma conversa ainda" : "Nada neste filtro"}
          description={contacts.length === 0 ? "Quando um cliente mandar mensagem no WhatsApp da loja, a conversa aparece aqui." : "Troque o filtro para ver as outras."}
        />
      ) : (
        <ul className="min-h-0 space-y-1 overflow-y-auto md:max-h-[calc(100dvh-22rem)]">
          {visible.map((contact) => {
            const selected = contact.id === selectedId;
            const attention = needsStaff(contact);
            const HandlerIcon = contact.handler === "ai" ? Bot : UserRound;
            return (
              <li key={contact.id}>
                <button
                  type="button"
                  onClick={() => onSelect(contact.id)}
                  aria-current={selected ? "true" : undefined}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition-colors",
                    selected ? "border-electric/40 bg-electric/10" : "border-transparent hover:bg-white/[0.04]",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-10 shrink-0 place-items-center rounded-full",
                      contact.handler === "ai" ? "bg-electric/15 text-electric" : "bg-emerald-400/15 text-emerald-300",
                    )}
                    title={contact.handler === "ai" ? "A IA está atendendo" : "Você está atendendo"}
                  >
                    <HandlerIcon aria-hidden className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={cn("truncate text-sm", attention ? "font-semibold text-white" : "font-medium text-fog")}>
                        {contact.name ?? formatPhone(contact.phone)}
                      </span>
                      <time dateTime={contact.lastMessageAt} className="shrink-0 text-[0.7rem] text-mist">
                        {sinceLabel(contact.lastMessageAt)}
                      </time>
                    </span>
                    <span className="mt-0.5 flex items-center gap-2">
                      <span className={cn("truncate text-xs", attention ? "text-fog" : "text-mist")}>{contact.lastMessagePreview ?? "…"}</span>
                      {attention && (
                        <span className="ml-auto grid min-w-5 shrink-0 place-items-center rounded-full bg-pink px-1.5 text-[0.68rem] leading-5 font-bold text-ink tabular-nums">
                          <span className="sr-only">Mensagens sem resposta: </span>
                          {contact.unreadCount}
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-[0.68rem] text-mist">
                      {CONTACT_KIND_LABEL[contact.kind]}
                      {contact.optedOut && " · pediu para parar"}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
