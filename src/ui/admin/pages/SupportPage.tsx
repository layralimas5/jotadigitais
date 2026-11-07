import { MessageSquare, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listSupportTickets } from "@/application/support-use-cases";
import { isPendingTicket, type SupportTicket } from "@/domain/support-ticket";
import { ButtonLink } from "@/ui/components/Button";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { Fab, LoadingBlock, PageHeader } from "../components/AdminUi";
import { FilterChips } from "../components/FilterChips";
import { useAdminQuery } from "../hooks";
import { formatRelative } from "../lib/dates";
import { useAdminRole } from "../session";
import { authorNameOf, SupportAreaBadge, SupportPriorityBadge, SupportStatusBadge } from "../support/SupportBadges";

type Filter = "pending" | "done" | "all";

const NEW_TICKET_PATH = "/admin/suporte/novo";

const FILTERS: Record<Filter, (ticket: SupportTicket) => boolean> = {
  pending: isPendingTicket,
  done: (ticket) => !isPendingTicket(ticket),
  all: () => true,
};

const DESCRIPTION = {
  admin: "Peça ajustes no sistema ou no site e acompanhe cada resposta aqui.",
  developer: "O que o Jota pediu de ajuste no sistema e no site. Mude a situação conforme for resolvendo.",
} as const;

function TicketCard({ ticket }: { ticket: SupportTicket }) {
  const replies = ticket.replies.length;
  return (
    <li className="relative rounded-2xl border border-line bg-surface/60 p-4 transition-colors hover:border-line-strong hover:bg-surface sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <SupportStatusBadge status={ticket.status} />
        <SupportPriorityBadge priority={ticket.priority} />
        <SupportAreaBadge area={ticket.area} />
      </div>
      <h2 className="mt-3 font-semibold text-white">
        <Link to={`/admin/suporte/${ticket.id}`} className="after:absolute after:inset-0 hover:text-electric-soft focus-visible:outline-none">
          {ticket.title}
        </Link>
      </h2>
      <p className="mt-1 line-clamp-2 text-sm text-mist">{ticket.description}</p>
      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mist">
        <span>
          {authorNameOf(ticket.author)} · {formatRelative(ticket.createdAt)}
        </span>
        <span className="inline-flex items-center gap-1">
          <MessageSquare aria-hidden className="size-3.5" />
          {replies} {replies === 1 ? "resposta" : "respostas"}
        </span>
      </p>
    </li>
  );
}

export default function SupportPage() {
  const role = useAdminRole() ?? "admin";
  const tickets = useAdminQuery(listSupportTickets, "admin-support");
  const [filter, setFilter] = useState<Filter>("pending");
  const data = tickets.status === "success" ? tickets.data : null;
  const visible = useMemo(() => (data ? data.filter(FILTERS[filter]) : []), [data, filter]);
  const count = (key: Filter) => (data ? data.filter(FILTERS[key]).length : 0);

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
          description="Viu algo errado ou quer mudar alguma coisa no sistema ou no site? Abra um chamado e conte o que precisa."
          action={
            <ButtonLink to={NEW_TICKET_PATH}>
              <Plus aria-hidden className="size-4" /> Abrir chamado
            </ButtonLink>
          }
        />
      )}
      {data && data.length > 0 && (
        <>
          <FilterChips
            label="Situação dos chamados"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "pending", label: "Pendentes", count: count("pending") },
              { value: "done", label: "Resolvidos", count: count("done") },
              { value: "all", label: "Todos", count: count("all") },
            ]}
          />
          {visible.length === 0 ? (
            <EmptyState
              title={filter === "pending" ? "Nada pendente" : "Nenhum chamado aqui"}
              description={filter === "pending" ? "Todos os chamados foram resolvidos." : "Troque o filtro para ver os outros."}
            />
          ) : (
            <ul className="grid gap-3">
              {visible.map((ticket) => (
                <TicketCard key={ticket.id} ticket={ticket} />
              ))}
            </ul>
          )}
        </>
      )}
      <Fab to={NEW_TICKET_PATH} label="Novo chamado" />
    </div>
  );
}
