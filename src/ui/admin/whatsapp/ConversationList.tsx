import { CONTACT_KIND_LABEL, needsStaff, type WhatsAppContact, type WhatsAppContactKind } from "@/domain/whatsapp";
import { cn } from "@/ui/lib/cn";
import { formatPhone } from "../lib/whatsapp";
import { ContactAvatar } from "./ContactAvatar";

export type ConversationFilter = "all" | "waiting" | "ai";
export type KindFilter = WhatsAppContactKind | "any";

const relative = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });
const clock = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** "agora", "há 5 min", "há 3 h", "12/11". */
export function sinceLabel(iso: string, now = Date.now()): string {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return relative.format(-minutes, "minute");
  if (minutes < 24 * 60) return relative.format(-Math.round(minutes / 60), "hour");
  return shortDate.format(new Date(iso));
}

/** Hora para hoje, data para os outros dias: como em qualquer app de mensagem. */
function listTime(iso: string, now = new Date()): string {
  const date = new Date(iso);
  return date.toDateString() === now.toDateString() ? clock.format(date) : shortDate.format(date);
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

function FilterTabs({ value, waiting, onChange }: { value: ConversationFilter; waiting: number; onChange: (next: ConversationFilter) => void }) {
  const tabs: readonly { value: ConversationFilter; label: string; count?: number }[] = [
    { value: "all", label: "Todas" },
    { value: "waiting", label: "Com você", count: waiting },
    { value: "ai", label: "Com a IA" },
  ];
  return (
    <div role="group" aria-label="Mostrar conversas" className="flex min-w-0 gap-4">
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              "-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 whitespace-nowrap pt-1 pb-2.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric",
              active ? "border-white font-medium text-white" : "border-transparent text-mist hover:text-fog",
            )}
          >
            {tab.label}
            {tab.count ? <span className="text-xs text-pink tabular-nums">{tab.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

function ConversationRow({ contact, selected, onSelect }: { contact: WhatsAppContact; selected: boolean; onSelect: () => void }) {
  const attention = needsStaff(contact);
  const name = contact.name ?? formatPhone(contact.phone);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "relative flex w-full items-center gap-3 px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-electric",
        selected ? "bg-white/[0.05]" : "hover:bg-white/[0.025]",
      )}
    >
      {selected && <span aria-hidden className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-electric" />}
      <ContactAvatar name={contact.name} phone={contact.phone} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className={cn("truncate text-sm", attention ? "font-semibold text-white" : "font-medium text-fog")}>{name}</span>
          <time dateTime={contact.lastMessageAt} title={sinceLabel(contact.lastMessageAt)} className={cn("shrink-0 text-[0.7rem] tabular-nums", attention ? "text-pink" : "text-mist")}>
            {listTime(contact.lastMessageAt)}
          </time>
        </span>
        <span className="mt-0.5 flex items-center gap-3">
          <span className={cn("truncate text-[0.8rem]", attention ? "text-fog" : "text-mist")}>{contact.lastMessagePreview ?? "…"}</span>
          {attention && (
            <span className="ml-auto grid h-[1.125rem] min-w-[1.125rem] shrink-0 place-items-center rounded-full bg-pink px-1 text-[0.65rem] font-semibold text-ink tabular-nums">
              <span className="sr-only">Mensagens sem resposta: </span>
              {contact.unreadCount}
            </span>
          )}
        </span>
        <span className="mt-1 block text-[0.7rem] text-mist/80">
          {CONTACT_KIND_LABEL[contact.kind]}
          <span aria-hidden> · </span>
          {contact.handler === "ai" ? "IA atendendo" : "Com você"}
          {contact.optedOut && " · pediu para parar"}
        </span>
      </span>
    </button>
  );
}

export function ConversationList({ contacts, selectedId, filter, kind, onFilter, onKind, onSelect }: ConversationListProps) {
  const waiting = contacts.filter(needsStaff).length;
  const visible = filterContacts(contacts, filter, kind);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-end justify-between gap-3 border-b border-line px-4 pt-3">
        <FilterTabs value={filter} waiting={waiting} onChange={onFilter} />
        <label className="sr-only" htmlFor="whatsapp-kind-filter">
          Tipo de contato
        </label>
        <select
          id="whatsapp-kind-filter"
          value={kind}
          onChange={(event) => onKind(event.target.value as KindFilter)}
          className="mb-2 max-w-[6.5rem] shrink-0 cursor-pointer truncate rounded-md bg-transparent py-1 pr-1 text-xs text-mist [color-scheme:dark] hover:text-fog focus-visible:outline-2 focus-visible:outline-electric"
        >
          {KIND_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {visible.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm font-medium text-fog">{contacts.length === 0 ? "Nenhuma conversa ainda" : "Nada neste filtro"}</p>
          <p className="mt-1 text-xs text-mist">
            {contacts.length === 0 ? "Quando um cliente mandar mensagem no WhatsApp da loja, ela aparece aqui." : "Troque o filtro para ver as outras."}
          </p>
        </div>
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-line/60 overflow-y-auto">
          {visible.map((contact) => (
            <li key={contact.id}>
              <ConversationRow contact={contact} selected={contact.id === selectedId} onSelect={() => onSelect(contact.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
