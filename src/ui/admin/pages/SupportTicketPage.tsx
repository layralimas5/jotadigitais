import { ArrowLeft, Hourglass, Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { SUPPORT_TEXT_MAX } from "@/application/schemas";
import { changeSupportStatus, findSupportTicket, replyToSupportTicket } from "@/application/support-use-cases";
import type { AdminRole } from "@/domain/admin-user";
import {
  canChangeSupportStatus,
  SUPPORT_STATUS_LABEL,
  SUPPORT_STATUSES,
  type SupportAttachment,
  type SupportAuthor,
  type SupportStatus,
  type SupportTicket,
  type SupportUpload,
} from "@/domain/support-ticket";
import { Button } from "@/ui/components/Button";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { cn } from "@/ui/lib/cn";
import { InlineError, LoadingBlock } from "../components/AdminUi";
import { SegmentedField, TextAreaField } from "../components/FormControls";
import { PersonAvatar } from "../components/PersonAvatar";
import { RoleBadge } from "../components/RoleBadge";
import { useAdminQuery, useMutation, usePolling } from "../hooks";
import { formatDate, formatRelative } from "../lib/dates";
import { useAdminRole } from "../session";
import { AttachmentGallery } from "../support/AttachmentGallery";
import { AttachmentPicker, uploadsOf, usePickedFiles } from "../support/AttachmentPicker";
import {
  authorNameOf,
  STATUS_TONE,
  SupportAreaBadge,
  SupportKindBadge,
  SupportPriorityBadge,
  SupportStatusBadge,
} from "../support/SupportBadges";
import { useToast } from "../toast";

const LIST_PATH = "/admin/suporte";
/** A conversa se atualiza sozinha: a resposta de um aparece para o outro sem recarregar. */
const REFRESH_MS = 20_000;

const STATUS_OPTIONS = SUPPORT_STATUSES.map((value) => ({
  value,
  label: SUPPORT_STATUS_LABEL[value],
  selectedClassName: cn(STATUS_TONE[value], "text-white"),
}));

interface MessageProps {
  author: SupportAuthor | null;
  body: string;
  createdAt: string;
  attachments: readonly SupportAttachment[];
  /** Mensagem de quem está vendo: fica do lado direito, como num chat. */
  own: boolean;
}

function Message({ author, body, createdAt, attachments, own }: MessageProps) {
  const name = authorNameOf(author);
  return (
    <li className={cn("flex gap-3", own && "flex-row-reverse")}>
      <PersonAvatar name={name} />
      <div
        className={cn(
          "min-w-0 flex-1 rounded-2xl border p-4 sm:max-w-[85%] sm:flex-none",
          own ? "rounded-tr-md border-electric/25 bg-electric/[0.07]" : "rounded-tl-md border-line bg-surface/60",
        )}
      >
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-white">{name}</span>
          {author && <RoleBadge role={author.role} />}
          <time dateTime={createdAt} title={formatDate(createdAt)} className="text-xs text-mist">
            {formatRelative(createdAt)}
          </time>
        </p>
        <p className="mt-2 text-sm leading-relaxed break-words whitespace-pre-wrap text-fog">{body}</p>
        <AttachmentGallery attachments={attachments} />
      </div>
    </li>
  );
}

function StatusControl({ ticket, role, onChanged }: { ticket: SupportTicket; role: AdminRole; onChanged: () => void }) {
  const toast = useToast();
  const change = useMutation(async (deps, status: SupportStatus) => {
    await changeSupportStatus(deps, role, ticket.id, status);
    return status;
  });

  const onChange = async (status: SupportStatus) => {
    if (status === ticket.status || change.pending) return;
    const changed = await change.run(status);
    if (!changed) return;
    toast.show(`Chamado: ${SUPPORT_STATUS_LABEL[changed].toLowerCase()}.`);
    onChanged();
  };

  return (
    <section aria-label="Situação do chamado" aria-busy={change.pending} className="rounded-3xl border border-line bg-surface/60 p-5">
      <SegmentedField legend="Situação" name="status" columns={4} value={ticket.status} options={STATUS_OPTIONS} onChange={(status) => void onChange(status)} />
      <p className="mt-2 text-xs text-mist">O Jota vê a situação na hora. Quando ele responde um chamado aguardando, ele volta sozinho para pendente.</p>
      {change.error && (
        <div className="mt-3">
          <InlineError message={change.error.message} />
        </div>
      )}
    </section>
  );
}

/** Para o Jota: deixa claro quando a bola está com ele. */
function WaitingNotice() {
  return (
    <p role="status" className="flex items-start gap-3 rounded-2xl border border-amber-300/30 bg-amber-300/[0.08] px-4 py-3 text-sm text-amber-100">
      <Hourglass aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-300" />
      A Layra está esperando você analisar ou responder. Quando você responder, o chamado volta para a fila dela.
    </p>
  );
}

interface ReplyInput {
  body: string;
  uploads: SupportUpload[];
  askAdmin: boolean;
}

function ReplyForm({ ticket, role, onSent }: { ticket: SupportTicket; role: AdminRole; onSent: () => void }) {
  const toast = useToast();
  const [body, setBody] = useState("");
  const [askAdmin, setAskAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const picked = usePickedFiles();
  const reply = useMutation(async (deps, input: ReplyInput) => {
    const result = await replyToSupportTicket(deps, ticket.id, { body: input.body }, input.uploads);
    if (input.askAdmin) await changeSupportStatus(deps, role, ticket.id, "waiting");
    return result;
  });
  const canAskAdmin = canChangeSupportStatus(role) && ticket.status !== "waiting";

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!body.trim()) {
      setError("Escreva a resposta.");
      return;
    }
    setError(null);
    const sent = await reply.run({ body, uploads: uploadsOf(picked.files), askAdmin: canAskAdmin && askAdmin });
    if (!sent) return;
    if (sent.failedUploads.length) toast.show(`Resposta enviada, mas não subiu: ${sent.failedUploads.join(", ")}.`, "error");
    setBody("");
    setAskAdmin(false);
    picked.clear();
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
      <div className="mt-4">
        <AttachmentPicker files={picked.files} onAdd={picked.add} onRemove={picked.remove} disabled={reply.pending} />
      </div>
      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        {canAskAdmin ? (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-fog">
            <input
              type="checkbox"
              checked={askAdmin}
              onChange={(event) => setAskAdmin(event.target.checked)}
              className="size-4 accent-[var(--color-electric)]"
            />
            Pedir resposta do Jota (muda para “Aguardando o Jota”)
          </label>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={reply.pending} className="self-end">
          <Send aria-hidden className="size-4" /> {reply.pending ? "Enviando…" : "Enviar resposta"}
        </Button>
      </div>
    </form>
  );
}

function TicketView({ ticket, role, reload }: { ticket: SupportTicket; role: AdminRole; reload: () => void }) {
  const attachmentsOf = (replyId: string | null) => ticket.attachments.filter((attachment) => attachment.replyId === replyId);
  return (
    <div className="mt-4 grid gap-6">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <SupportStatusBadge status={ticket.status} />
          <SupportPriorityBadge priority={ticket.priority} />
          <SupportKindBadge kind={ticket.kind} />
          <SupportAreaBadge area={ticket.area} />
        </div>
        <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight break-words text-white sm:text-3xl">{ticket.title}</h1>
        <p className="mt-1.5 text-sm text-mist">
          Aberto por {authorNameOf(ticket.author)} em {formatDate(ticket.createdAt)}
          {ticket.resolvedAt && ` · finalizado em ${formatDate(ticket.resolvedAt)}`}
        </p>
      </header>

      {canChangeSupportStatus(role) && <StatusControl ticket={ticket} role={role} onChanged={reload} />}
      {role === "admin" && ticket.status === "waiting" && <WaitingNotice />}

      <section aria-labelledby="conversa">
        <h2 id="conversa" className="mb-3 text-xs font-semibold tracking-[0.16em] text-mist uppercase">
          Conversa
        </h2>
        <ol className="grid gap-4">
          <Message
            author={ticket.author}
            body={ticket.description}
            createdAt={ticket.createdAt}
            attachments={attachmentsOf(null)}
            own={ticket.author?.role === role}
          />
          {ticket.replies.map((reply) => (
            <Message
              key={reply.id}
              author={reply.author}
              body={reply.body}
              createdAt={reply.createdAt}
              attachments={attachmentsOf(reply.id)}
              own={reply.author?.role === role}
            />
          ))}
        </ol>
      </section>

      <ReplyForm ticket={ticket} role={role} onSent={reload} />
    </div>
  );
}

export default function SupportTicketPage() {
  const { id = "" } = useParams();
  const role = useAdminRole() ?? "admin";
  const ticket = useAdminQuery((deps) => findSupportTicket(deps, id), `admin-support-${id}`);
  usePolling(ticket.reload, REFRESH_MS);

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
