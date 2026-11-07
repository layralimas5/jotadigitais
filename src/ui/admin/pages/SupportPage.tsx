import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, Crosshair, FilterX, MessageSquare, Paperclip, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { listSupportLabels, listSupportTickets } from "@/application/support-use-cases";
import type { AdminRole } from "@/domain/admin-user";
import {
  canManageSupportLabels,
  inPeriod,
  isPendingTicket,
  needsActionFrom,
  SUPPORT_KIND_LABEL,
  SUPPORT_KINDS,
  SUPPORT_PERIOD_LABEL,
  SUPPORT_PERIODS,
  SUPPORT_PRIORITIES,
  SUPPORT_PRIORITY_LABEL,
  type SupportKind,
  type SupportLabel,
  type SupportPeriod,
  type SupportPriority,
  type SupportStatus,
  type SupportTicket,
} from "@/domain/support-ticket";
import { Button, ButtonLink } from "@/ui/components/Button";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { cn } from "@/ui/lib/cn";
import { Fab, LoadingBlock, PageHeader } from "../components/AdminUi";
import { FilterSelect } from "../components/FilterSelect";
import { useAdminQuery, usePolling } from "../hooks";
import { formatRelative } from "../lib/dates";
import { useViewRole } from "../admin-view";
import { LABEL_TONE } from "../support/label-tone";
import { LabelManager } from "../support/LabelManager";
import { LabelPicker } from "../support/LabelPicker";
import { PRIORITY_TONE } from "../support/priority-tone";
import {
  authorNameOf,
  KIND_ICON,
  NeedsYouBadge,
  PriorityDot,
  SupportAreaBadge,
  SupportLabelBadge,
  SupportPriorityBadge,
  SupportStatusBadge,
} from "../support/SupportBadges";
import { TicketProgress } from "../support/TicketProgress";

type StatusFilter = "mine" | "active" | SupportStatus | "all";
type KindFilter = SupportKind | "all";
type PriorityFilter = SupportPriority | "all";
/** "all", "none" (sem etiqueta) ou o id da etiqueta. */
type LabelFilter = string;

interface Filters {
  period: SupportPeriod;
  status: StatusFilter;
  kind: KindFilter;
  priority: PriorityFilter;
  label: LabelFilter;
}

const DEFAULT_FILTERS: Filters = { period: "all", status: "active", kind: "all", priority: "all", label: "all" };

const NEW_TICKET_PATH = "/admin/suporte/novo";

/** Chamado recém-aberto que a ficha manda para a listagem abrir no andamento. */
function openedTicketIdOf(state: unknown): string | null {
  if (typeof state !== "object" || state === null || !("openedTicketId" in state)) return null;
  const { openedTicketId } = state;
  return typeof openedTicketId === "string" ? openedTicketId : null;
}
const REFRESH_MS = 30_000;

const STATUS_FILTERS: Record<StatusFilter, (ticket: SupportTicket, role: AdminRole) => boolean> = {
  mine: needsActionFrom,
  active: isPendingTicket,
  in_progress: (ticket) => ticket.status === "in_progress",
  open: (ticket) => ticket.status === "open",
  waiting: (ticket) => ticket.status === "waiting",
  done: (ticket) => ticket.status === "done",
  all: () => true,
};

const STATUS_FILTER_LABEL: Record<StatusFilter, string> = {
  mine: "Precisa de mim",
  active: "Em aberto",
  in_progress: "Fazendo agora",
  open: "Pendentes",
  waiting: "Aguardando o Jota",
  done: "Finalizados",
  all: "Todas as situações",
};

const STATUS_FILTER_ORDER: readonly StatusFilter[] = ["active", "mine", "in_progress", "open", "waiting", "done", "all"];

const DESCRIPTION: Record<AdminRole, string> = {
  admin: "Seus pedidos de ajuste, melhoria e pendências do sistema e do site. Abra a setinha de cada chamado para ver o andamento.",
  developer: "Os pedidos do Jota. Filtre o que priorizar, marque a etiqueta e abra a setinha para ver o andamento.",
};

function matchesFilters(ticket: SupportTicket, filters: Filters, role: AdminRole): boolean {
  return (
    inPeriod(ticket, filters.period) &&
    STATUS_FILTERS[filters.status](ticket, role) &&
    (filters.kind === "all" || ticket.kind === filters.kind) &&
    (filters.priority === "all" || ticket.priority === filters.priority) &&
    (filters.label === "all" || (filters.label === "none" ? ticket.labelId === null : ticket.labelId === filters.label))
  );
}

const withCount = (label: string, count: number) => `${label} (${count})`;

// ---------------------------------------------------------------------------
// Barra de filtros
// ---------------------------------------------------------------------------

interface FilterBarProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  tickets: readonly SupportTicket[];
  labels: readonly SupportLabel[];
  role: AdminRole;
}

function FilterBar({ filters, onChange, tickets, labels, role }: FilterBarProps) {
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => onChange({ ...filters, [key]: value });
  /** Conta com todos os outros filtros aplicados, para o número bater com o que vai aparecer. */
  const countWith = (patch: Partial<Filters>) => tickets.filter((ticket) => matchesFilters(ticket, { ...filters, ...patch }, role)).length;
  const changed = (Object.keys(DEFAULT_FILTERS) as (keyof Filters)[]).some((key) => filters[key] !== DEFAULT_FILTERS[key]);

  return (
    <section aria-label="Filtros dos chamados" className="rounded-3xl border border-line bg-surface/40 p-3 sm:p-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        <FilterSelect
          label="Período"
          value={filters.period}
          onChange={(value) => set("period", value)}
          options={SUPPORT_PERIODS.map((value) => ({ value, label: SUPPORT_PERIOD_LABEL[value] }))}
        />
        <FilterSelect
          label="Situação"
          value={filters.status}
          onChange={(value) => set("status", value)}
          options={STATUS_FILTER_ORDER.map((value) => ({ value, label: withCount(STATUS_FILTER_LABEL[value], countWith({ status: value })) }))}
        />
        <FilterSelect
          label="Tipo"
          value={filters.kind}
          onChange={(value) => set("kind", value)}
          options={[
            { value: "all" as const, label: "Todos os tipos" },
            ...SUPPORT_KINDS.map((value) => ({ value, label: withCount(SUPPORT_KIND_LABEL[value], countWith({ kind: value })) })),
          ]}
        />
        <FilterSelect
          label="Prioridade"
          value={filters.priority}
          onChange={(value) => set("priority", value)}
          options={[
            { value: "all" as const, label: "Todas as prioridades" },
            ...SUPPORT_PRIORITIES.map((value) => ({
              value,
              label: withCount(SUPPORT_PRIORITY_LABEL[value], countWith({ priority: value })),
              dotClassName: PRIORITY_TONE[value].dot,
            })),
          ]}
        />
        <FilterSelect
          label="Etiqueta"
          value={filters.label}
          onChange={(value) => set("label", value)}
          className="col-span-2 sm:col-span-1"
          options={[
            { value: "all", label: "Todas as etiquetas" },
            { value: "none", label: withCount("Sem etiqueta", countWith({ label: "none" })), dotClassName: "border border-white/30" },
            ...labels.map((label) => ({ value: label.id, label: withCount(label.name, countWith({ label: label.id })), dotClassName: LABEL_TONE[label.color].dot })),
          ]}
        />
      </div>
      {changed && (
        <button
          type="button"
          onClick={() => onChange(DEFAULT_FILTERS)}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-mist hover:text-white"
        >
          <FilterX aria-hidden className="size-3.5" /> Limpar filtros
        </button>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Lista
// ---------------------------------------------------------------------------

interface RowProps {
  ticket: SupportTicket;
  role: AdminRole;
  labels: readonly SupportLabel[];
  expanded: boolean;
  onToggle: () => void;
  onChanged: () => void;
}

function LabelCell({ ticket, role, labels, onChanged }: Omit<RowProps, "expanded" | "onToggle">) {
  if (canManageSupportLabels(role)) {
    return <LabelPicker ticketId={ticket.id} ticketTitle={ticket.title} labelId={ticket.labelId} labels={labels} role={role} onChanged={onChanged} />;
  }
  const label = labels.find((item) => item.id === ticket.labelId);
  return label ? <SupportLabelBadge label={label} /> : <span className="text-xs text-mist">Sem etiqueta</span>;
}

function TicketRow({ ticket, role, labels, expanded, onToggle, onChanged }: RowProps) {
  const reduceMotion = useReducedMotion();
  const KindIcon = KIND_ICON[ticket.kind];
  const panelId = `andamento-${ticket.id}`;
  const replies = ticket.replies.length;
  const files = ticket.attachments.length;

  return (
    <li className={cn("rounded-2xl border bg-surface/60 transition-colors", ticket.status === "in_progress" ? "border-electric/40" : "border-line", expanded && "bg-surface")}>
      <div className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_7.5rem_9rem_14rem_2.5rem] lg:items-center lg:gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs text-mist">
              <KindIcon aria-hidden className="size-3.5" /> {SUPPORT_KIND_LABEL[ticket.kind]}
            </span>
            <SupportAreaBadge area={ticket.area} />
            {needsActionFrom(ticket, role) && <NeedsYouBadge />}
          </div>
          <h2 className="mt-1.5 truncate font-semibold text-white">
            <Link to={`/admin/suporte/${ticket.id}`} className="hover:text-electric-soft">
              {ticket.title}
            </Link>
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mist">
            <span>
              {authorNameOf(ticket.author)} · mexido {formatRelative(ticket.updatedAt)}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageSquare aria-hidden className="size-3.5" /> {replies}
            </span>
            {files > 0 && (
              <span className="inline-flex items-center gap-1">
                <Paperclip aria-hidden className="size-3.5" /> {files}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:contents">
          <div>
            <SupportPriorityBadge priority={ticket.priority} />
          </div>
          <div>
            <SupportStatusBadge status={ticket.status} />
          </div>
          <div className="min-w-44 flex-1 lg:min-w-0">
            <LabelCell ticket={ticket} role={role} labels={labels} onChanged={onChanged} />
          </div>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-controls={panelId}
            aria-label={expanded ? `Fechar andamento de ${ticket.title}` : `Ver andamento de ${ticket.title}`}
            className="ml-auto grid size-10 shrink-0 place-items-center rounded-full border border-line-strong text-mist transition-colors hover:border-white/30 hover:text-white lg:ml-0"
          >
            <ChevronDown aria-hidden className={cn("size-5 transition-transform duration-200", expanded && "rotate-180 text-white")} />
          </button>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id={panelId}
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-line px-4 py-4 sm:px-5">
              <TicketProgress ticket={ticket} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

/** Cabeçalho das colunas, só no computador. */
function ListHeader() {
  return (
    <div
      aria-hidden
      className="hidden px-4 text-xs font-medium text-mist lg:grid lg:grid-cols-[minmax(0,1fr)_7.5rem_9rem_14rem_2.5rem] lg:gap-4"
    >
      <span>Chamado</span>
      <span>Prioridade</span>
      <span>Situação</span>
      <span>Etiqueta</span>
      <span className="sr-only">Andamento</span>
    </div>
  );
}

/** O que a Layra está fazendo agora, sempre à vista no topo. */
function FocusStrip({ tickets }: { tickets: SupportTicket[] }) {
  if (tickets.length === 0) return null;
  return (
    <section aria-labelledby="foco" className="rounded-3xl border border-electric/30 bg-electric/[0.06] p-4 sm:p-5">
      <h2 id="foco" className="flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-electric-soft uppercase">
        <Crosshair aria-hidden className="size-4" /> Fazendo agora
      </h2>
      <ul className="mt-3 grid gap-2">
        {tickets.map((ticket) => (
          <li key={ticket.id}>
            <Link to={`/admin/suporte/${ticket.id}`} className="flex items-center gap-2 text-sm font-medium text-white hover:text-electric-soft">
              <PriorityDot priority={ticket.priority} className="size-2" />
              <span className="truncate">{ticket.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function SupportPage() {
  // No modo "ver como o Jota" a tela é a dele: sem etiquetas para editar nem controle de situação.
  const role = useViewRole() ?? "admin";
  const tickets = useAdminQuery(listSupportTickets, "admin-support");
  const labels = useAdminQuery(listSupportLabels, "admin-support-labels");
  usePolling(tickets.reload, REFRESH_MS);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const openedTicketId = openedTicketIdOf(useLocation().state);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(openedTicketId ? [openedTicketId] : []));
  const data = tickets.status === "success" ? tickets.data : null;
  const labelList = labels.status === "success" ? labels.data : [];
  const visible = useMemo(() => (data ? data.filter((ticket) => matchesFilters(ticket, filters, role)) : []), [data, filters, role]);

  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const reloadAll = () => {
    tickets.reload();
    labels.reload();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suporte"
        description={DESCRIPTION[role]}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {canManageSupportLabels(role) && <LabelManager labels={labelList} role={role} onChanged={reloadAll} />}
            <ButtonLink to={NEW_TICKET_PATH} className="max-md:hidden">
              <Plus aria-hidden className="size-4" /> Novo chamado
            </ButtonLink>
          </div>
        }
      />

      {tickets.status === "loading" && <LoadingBlock />}
      {tickets.status === "error" && <ErrorState message={tickets.error.message} onRetry={tickets.reload} />}
      {data && data.length === 0 && (
        <EmptyState
          title="Nenhum chamado ainda"
          description="Viu algo errado, teve uma ideia de melhoria ou tem uma pendência no sistema ou no site? Abra um chamado e conte o que precisa."
          action={
            <ButtonLink to={NEW_TICKET_PATH}>
              <Plus aria-hidden className="size-4" /> Abrir chamado
            </ButtonLink>
          }
        />
      )}
      {data && data.length > 0 && (
        <>
          <FilterBar filters={filters} onChange={setFilters} tickets={data} labels={labelList} role={role} />
          <FocusStrip tickets={data.filter((ticket) => ticket.status === "in_progress")} />
          {visible.length === 0 ? (
            <EmptyState
              title="Nenhum chamado com esses filtros"
              description="Troque o período, a situação ou a prioridade para ver os outros."
              action={
                <Button variant="secondary" onClick={() => setFilters(DEFAULT_FILTERS)}>
                  <FilterX aria-hidden className="size-4" /> Limpar filtros
                </Button>
              }
            />
          ) : (
            <div className="space-y-2">
              <ListHeader />
              <ul aria-label="Chamados" className="grid gap-2">
                {visible.map((ticket) => (
                  <TicketRow
                    key={ticket.id}
                    ticket={ticket}
                    role={role}
                    labels={labelList}
                    expanded={expanded.has(ticket.id)}
                    onToggle={() => toggle(ticket.id)}
                    onChanged={reloadAll}
                  />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      <Fab to={NEW_TICKET_PATH} label="Novo chamado" />
    </div>
  );
}
