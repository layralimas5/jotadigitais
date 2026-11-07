import { ArrowLeft, Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { SUPPORT_TEXT_MAX } from "@/application/schemas";
import { changeSupportStatus, findSupportTicket, replyToSupportTicket } from "@/application/support-use-cases";
import type { AdminRole } from "@/domain/admin-user";
import {
  canChangeSupportStatus,
  SUPPORT_STATUS_LABEL,
  SUPPORT_STATUSES,
  type SupportAuthor,
  type SupportStatus,
  type SupportTicket,
} from "@/domain/support-ticket";
import { Button } from "@/ui/components/Button";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { InlineError, LoadingBlock } from "../components/AdminUi";
import { SegmentedField, TextAreaField } from "../components/FormControls";
import { PersonAvatar } from "../components/PersonAvatar";
import { RoleBadge } from "../components/RoleBadge";
import { useAdminQuery, useMutation } from "../hooks";
import { formatDate, formatRelative } from "../lib/dates";
import { useAdminRole } from "../session";
import { authorNameOf, SupportAreaBadge, SupportPriorityBadge, SupportStatusBadge } from "../support/SupportBadges";
import { useToast } from "../toast";

const LIST_PATH = "/admin/suporte";

const STATUS_OPTIONS = SUPPORT_STATUSES.map((value) => ({ value, label: SUPPORT_STATUS_LABEL[value] }));

function Message({ author, body, createdAt }: { author: SupportAuthor | null; body: string; createdAt: string }) {
  const name = authorNameOf(author);
  return (
    <li className="flex gap-3">
      <PersonAvatar name={name} />
      <div className="min-w-0 flex-1 rounded-2xl border border-line bg-surface/60 p-4">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-white">{name}</span>
          {author && <RoleBadge role={author.role} />}
          <time dateTime={createdAt} title={formatDate(createdAt)} className="text-xs text-mist">
            {formatRelative(createdAt)}
          </time>
        </p>
        <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-fog">{body}</p>
      </div>
    </li>
  );
}

function StatusControl({ ticket, role, onChanged }: { ticket: SupportTicket; role: AdminRole; onChanged: () => void }) {
  const toast = useToast();
  const [saved, setSaved] = useState(true);
  const change = useMutation(async (deps, status: SupportStatus) => {
    await changeSupportStatus(deps, role, ticket.id, status);
    return status;
  });

  const onChange = async (status: SupportStatus) => {
    if (status === ticket.status || change.pending) return;
    setSaved(false);
    const changed = await change.run(status);
    setSaved(true);
    if (!changed) return;
    toast.show(`Chamado marcado como ${SUPPORT_STATUS_LABEL[changed].toLowerCase()}.`);
    onChanged();
  };

  return (
    <section aria-label="Situação do chamado" aria-busy={!saved} className="rounded-3xl border border-line bg-surface/60 p-5">
      <SegmentedField
        legend="Situação"
        name="status"
        columns={3}
        value={ticket.status}
        options={STATUS_OPTIONS}
        onChange={(status) => void onChange(status)}
      />
      {change.error && (
        <div className="mt-3">
          <InlineError message={change.error.message} />
        </div>
      )}
    </section>
  );
}

function ReplyForm({ ticketId, onSent }: { ticketId: string; onSent: () => void }) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const reply = useMutation((deps, text: string) => replyToSupportTicket(deps, ticketId, { body: text }));

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!body.trim()) {
      setError("Escreva a resposta.");
      return;
    }
    setError(null);
    const sent = await reply.run(body);
    if (!sent) return;
    setBody("");
    onSent();
  };

  return (
    <form noValidate onSubmit={onSubmit} aria-busy={reply.pending} className="rounded-3xl border border-line bg-surface/60 p-5">
      <TextAreaField
        label="Responder"
        name="body"
        rows={4}
        maxLength={SUPPORT_TEXT_MAX}
        placeholder="Escreva uma atualização, uma dúvida ou mais detalhes."
        value={body}
        onChange={(event) => setBody(event.target.value)}
        error={error ?? reply.error?.message}
      />
      <div className="mt-4 flex justify-end">
        <Button type="submit" disabled={reply.pending}>
          <Send aria-hidden className="size-4" /> {reply.pending ? "Enviando…" : "Enviar resposta"}
        </Button>
      </div>
    </form>
  );
}

function TicketView({ ticket, role, reload }: { ticket: SupportTicket; role: AdminRole; reload: () => void }) {
  return (
    <div className="mt-4 grid gap-6">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <SupportStatusBadge status={ticket.status} />
          <SupportPriorityBadge priority={ticket.priority} />
          <SupportAreaBadge area={ticket.area} />
        </div>
        <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">{ticket.title}</h1>
        <p className="mt-1.5 text-sm text-mist">
          Aberto por {authorNameOf(ticket.author)} em {formatDate(ticket.createdAt)}
          {ticket.resolvedAt && ` · resolvido em ${formatDate(ticket.resolvedAt)}`}
        </p>
      </header>

      {canChangeSupportStatus(role) && <StatusControl ticket={ticket} role={role} onChanged={reload} />}

      <section aria-labelledby="conversa">
        <h2 id="conversa" className="sr-only">
          Conversa
        </h2>
        <ol className="grid gap-3">
          <Message author={ticket.author} body={ticket.description} createdAt={ticket.createdAt} />
          {ticket.replies.map((reply) => (
            <Message key={reply.id} author={reply.author} body={reply.body} createdAt={reply.createdAt} />
          ))}
        </ol>
      </section>

      <ReplyForm ticketId={ticket.id} onSent={reload} />
    </div>
  );
}

export default function SupportTicketPage() {
  const { id = "" } = useParams();
  const role = useAdminRole() ?? "admin";
  const ticket = useAdminQuery((deps) => findSupportTicket(deps, id), `admin-support-${id}`);

  return (
    <>
      <Link to={LIST_PATH} className="inline-flex items-center gap-2 text-sm text-mist hover:text-white">
        <ArrowLeft aria-hidden className="size-4" /> Voltar
      </Link>
      {ticket.status === "loading" && <LoadingBlock />}
      {ticket.status === "error" && <ErrorState message={ticket.error.message} onRetry={ticket.reload} />}
      {ticket.status === "success" && !ticket.data && (
        <div className="mt-6">
          <EmptyState title="Chamado não encontrado" description="Ele pode ter sido removido ou o link está incompleto." />
        </div>
      )}
      {ticket.status === "success" && ticket.data && <TicketView ticket={ticket.data} role={role} reload={ticket.reload} />}
    </>
  );
}
