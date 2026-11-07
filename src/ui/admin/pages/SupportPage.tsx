import { Crosshair, MessageSquare, Paperclip, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listSupportTickets } from "@/application/support-use-cases";
import type { AdminRole } from "@/domain/admin-user";
import {
  isPendingTicket,
  needsActionFrom,
  SUPPORT_PRIORITIES,
  SUPPORT_PRIORITY_LABEL,
  type SupportPriority,
  type SupportStatus,
  type SupportTicket,
} from "@/domain/support-ticket";
import { ButtonLink } from "@/ui/components/Button";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { cn } from "@/ui/lib/cn";
import { Fab, LoadingBlock, PageHeader } from "../components/AdminUi";
import { FilterChips } from "../components/FilterChips";
import { useAdminQuery, usePolling } from "../hooks";
import { formatRelative } from "../lib/dates";
import { useAdminRole } from "../session";
import {
  authorNameOf,
  NeedsYouBadge,
  PriorityDot,
  SupportAreaBadge,
  SupportKindBadge,
  SupportPriorityBadge,
  SupportStatusBadge,
} from "../support/SupportBadges";

type StatusFilter = "mine" | "active" | SupportStatus | "all";
type PriorityFilter = SupportPriority | "all";

const NEW_TICKET_PATH = "/admin/suporte/novo";
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
  all: "Todos",
};

const STATUS_FILTER_ORDER: readonly StatusFilter[] = ["mine", "active", "in_progress", "open", "waiting", "done", "all"];

const DESCRIPTION: Record<AdminRole, string> = {
  admin: "Seus pedidos de ajuste, melhoria e pendências do sistema e do site. Acompanhe o que foi resolvido, o que a Layra está fazendo agora e o que espera a sua resposta.",
  developer: "Os pedidos do Jota. Comece pelo que precisa de você e mude a situação conforme for andando.",
};

function TicketCard({ ticket, role }: { ticket: SupportTicket; role: AdminRole }) {
  const replies = ticket.replies.length;
  const files = ticket.attachments.length;
  return (
    <li
      className={cn(
        "relative rounded-2xl border bg-surface/60 p-4 transition-colors hover:bg-surface sm:p-5",
        ticket.status === "in_progress" ? "border-electric/40" : "border-line hover:border-line-strong",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <SupportStatusBadge status={ticket.status} />
        <SupportPriorityBadge priority={ticket.priority} />
        <SupportKindBadge kind={ticket.kind} />
        <SupportAreaBadge area={ticket.area} />
        {needsActionFrom(ticket, role) && <NeedsYouBadge />}
      </div>
      <h2 className="mt-3 font-semibold text-white">
        <Link to={`/admin/suporte/${ticket.id}`} className="after:absolute after:inset-0 hover:text-electric-soft focus-visible:outline-none">
          {ticket.title}
        </Link>
      </h2>
      <p className="mt-1 line-clamp-2 text-sm text-mist">{ticket.description}</p>
      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mist">
        <span>
          {authorNameOf(ticket.author)} · aberto {formatRelative(ticket.createdAt)} · mexido {formatRelative(ticket.updatedAt)}
        </span>
        <span className="inline-flex items-center gap-1">
          <MessageSquare aria-hidden className="size-3.5" />
          {replies} {replies === 1 ? "resposta" : "respostas"}
        </span>
        {files > 0 && (
          <span className="inline-flex items-center gap-1">
            <Paperclip aria-hidden className="size-3.5" />
            {files} {files === 1 ? "anexo" : "anexos"}
          </span>
        )}
      </p>
    </li>
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
  const role = useAdminRole() ?? "admin";
  const tickets = useAdminQuery(listSupportTickets, "admin-support");
  usePolling(tickets.reload, REFRESH_MS);
  const [status, setStatus] = useState<StatusFilter>("active");
  const [priority, setPriority] = useState<PriorityFilter>("all");
  const data = tickets.status === "success" ? tickets.data : null;

  const byStatus = useMemo(() => (data ? data.filter((ticket) => STATUS_FILTERS[status](ticket, role)) : []), [data, status, role]);
  const visible = useMemo(() => (priority === "all" ? byStatus : byStatus.filter((ticket) => ticket.priority === priority)), [byStatus, priority]);
  const statusCount = (key: StatusFilter) => (data ? data.filter((ticket) => STATUS_FILTERS[key](ticket, role)).length : 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suporte"
        description={DESCRIPTION[role]}
        action={
          <ButtonLink to={NEW_TICKET_PATH} className="max-md:hidden">
            <Plus aria-hidden className="size-4" /> Novo chamado
          </ButtonLink>
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
          <FocusStrip tickets={data.filter((ticket) => ticket.status === "in_progress")} />
          <div className="space-y-3">
            <FilterChips
              label="Situação"
              value={status}
              onChange={setStatus}
              options={STATUS_FILTER_ORDER.map((key) => ({ value: key, label: STATUS_FILTER_LABEL[key], count: statusCount(key) }))}
            />
            <FilterChips
              label="Prioridade"
              value={priority}
              onChange={setPriority}
              options={[
                { value: "all" as const, label: "Todas as prioridades", count: byStatus.length },
                ...SUPPORT_PRIORITIES.map((key) => ({
                  value: key,
                  label: SUPPORT_PRIORITY_LABEL[key],
                  count: byStatus.filter((ticket) => ticket.priority === key).length,
                  icon: <PriorityDot priority={key} className="size-2" />,
                })),
              ]}
            />
          </div>
          {visible.length === 0 ? (
            <EmptyState title="Nenhum chamado neste filtro" description="Troque a situação ou a prioridade para ver os outros." />
          ) : (
            <ul className="grid gap-3">
              {visible.map((ticket) => (
                <TicketCard key={ticket.id} ticket={ticket} role={role} />
              ))}
            </ul>
          )}
        </>
      )}
      <Fab to={NEW_TICKET_PATH} label="Novo chamado" />
    </div>
  );
}
