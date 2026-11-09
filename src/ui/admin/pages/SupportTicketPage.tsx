import { ArrowLeft, CornerUpLeft, Eye, EyeOff, Hourglass, RefreshCw, Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { SUPPORT_TEXT_MAX } from "@/application/schemas";
import {
  changeSupportStatus,
  findSupportTicket,
  listSupportLabels,
  markSupportTicketSeen,
  replyToSupportTicket,
  setSupportTicketVisibility,
  changeSupportPriority,
} from "@/application/support-use-cases";
import type { AdminRole } from "@/domain/admin-user";
import {
  canChangeSupportStatus,
  canChangeSupportVisibility,
  canManageSupportLabels,
  canNotifyAdmin,
  counterpartOf,
  seenAtBy,
  SUPPORT_ROLE_NAME,
  timelineOf,
  wasSeenBy,
  wasApprovedByAdmin,
  type SupportLabel,
  type SupportStatusEvent,
  statusesFor,
  SUPPORT_STATUS_LABEL,
  type SupportAttachment,
  type SupportAuthor,
  type SupportStatus,
  type SupportTicket,
  type SupportUpload,
  supportRoleOf,
  type SupportRole,
  canChangeSupportPriority,
  SUPPORT_PRIORITIES,
  SUPPORT_PRIORITY_LABEL,
  type SupportPriority,
  SUPPORT_OPENING_ID,
  quotedMessageOf,
  type SupportQuote,
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
import { useAdminView, useViewRole } from "../admin-view";
import { ApproveTicketButton } from "../support/ApproveTicketButton";
import { AttachmentGallery } from "../support/AttachmentGallery";
import { AttachmentPicker, pasteFilesInto, uploadsOf, usePickedFiles } from "../support/AttachmentPicker";
import { NotifyAdminCheckbox } from "../support/NotifyAdminCheckbox";
import { SeenMark } from "../support/SeenIndicator";
import { LabelPicker } from "../support/LabelPicker";
import { messageAnchorOf, QuoteInMessage, ReplyingTo, scrollToMessage } from "../support/ReplyQuote";
import { statusEventText } from "../support/TicketProgress";
import {
  ApprovedByAdminBadge,
  authorNameOf,
  InternalBadge,
  STATUS_TONE,
  SupportAreaBadge,
  SupportKindBadge,
  SupportLabelBadge,
  SupportPriorityBadge,
  SupportStatusBadge,
} from "../support/SupportBadges";
import { PRIORITY_TONE } from "../support/priority-tone";
import { useToast } from "../toast";

const LIST_PATH = "/admin/suporte";
/** A conversa se atualiza sozinha: a resposta de um aparece para o outro sem recarregar. */
const REFRESH_MS = 20_000;

const statusOptionsFor = (ticket: SupportTicket) =>
  statusesFor(ticket).map((value) => ({
    value,
    label: SUPPORT_STATUS_LABEL[value],
    selectedClassName: cn(STATUS_TONE[value], "text-white"),
  }));

interface MessageProps {
  /** Id da resposta, ou `SUPPORT_OPENING_ID` para a mensagem que abriu o chamado. */
  id: string;
  author: SupportAuthor | null;
  body: string;
  createdAt: string;
  attachments: readonly SupportAttachment[];
  /** Mensagem de quem está vendo: fica do lado direito, como num chat. */
  own: boolean;
  /** Só nas mensagens de quem está vendo: a outra pessoa já viu? Nulo em chamado interno. */
  seen: { seen: boolean; by: string; seenAt: string | null } | null;
  /** Mensagem que esta responde: `undefined` quando não cita nenhuma, `null` quando a citada sumiu. */
  quote?: SupportQuote | null;
  /** Está selecionada para responder ou acabou de ser aberta pela citação. */
  highlighted: boolean;
  onReply: () => void;
  onOpenQuote: (id: string) => void;
}

/** Duplo clique no balão também responde; o clique duplo seleciona uma palavra, então a seleção sai. */
function replyOnDoubleClick(onReply: () => void) {
  return () => {
    window.getSelection()?.removeAllRanges();
    onReply();
  };
}

function Message({ id, author, body, createdAt, attachments, own, seen, quote, highlighted, onReply, onOpenQuote }: MessageProps) {
  const name = authorNameOf(author);
  return (
    <li id={messageAnchorOf(id)} tabIndex={-1} className={cn("flex scroll-mt-24 gap-3 outline-none", own && "flex-row-reverse")}>
      <PersonAvatar name={name} />
      <div
        onDoubleClick={replyOnDoubleClick(onReply)}
        title="Clique duas vezes para responder"
        className={cn(
          "min-w-0 flex-1 rounded-2xl border p-4 transition-shadow duration-300 sm:max-w-[85%] sm:flex-none",
          own ? "rounded-tr-md border-electric/25 bg-electric/[0.07]" : "rounded-tl-md border-line bg-surface/60",
          highlighted && "ring-2 ring-electric/70",
        )}
      >
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-white">{name}</span>
          {author && <RoleBadge role={author.role} />}
          <time dateTime={createdAt} title={formatDate(createdAt)} className="text-xs text-mist">
            {formatRelative(createdAt)}
          </time>
          <button
            type="button"
            onClick={onReply}
            aria-label={`Responder a mensagem de ${name}`}
            title="Responder esta mensagem"
            className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-mist transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-2 focus-visible:outline-electric"
          >
            <CornerUpLeft aria-hidden className="size-3.5" />
            <span className="sr-only sm:not-sr-only">Responder</span>
          </button>
        </p>
        {quote !== undefined && <QuoteInMessage quote={quote} onOpen={onOpenQuote} />}
        <p className="mt-2 text-sm leading-relaxed break-words whitespace-pre-wrap text-fog">{body}</p>
        <AttachmentGallery attachments={attachments} />
        {seen && <SeenMark {...seen} className="mt-3" />}
      </div>
    </li>
  );
}

/** Troca de situação no meio da conversa, como uma linha do sistema. */
function StatusLine({ event }: { event: SupportStatusEvent }) {
  return (
    <li className="flex items-center justify-center gap-2 text-center text-xs text-mist">
      <span aria-hidden className="h-px flex-1 bg-line" />
      <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1", STATUS_TONE[event.to])}>
        <RefreshCw aria-hidden className="size-3" />
        {statusEventText(event)}
        <time dateTime={event.createdAt} title={formatDate(event.createdAt)} className="opacity-80">
          · {formatRelative(event.createdAt)}
        </time>
      </span>
      <span aria-hidden className="h-px flex-1 bg-line" />
    </li>
  );
}

function StatusControl({ ticket, role, onChanged }: { ticket: SupportTicket; role: SupportRole; onChanged: () => void }) {
  const toast = useToast();
  const change = useMutation(async (deps, status: SupportStatus) => {
    await changeSupportStatus(deps, role, ticket.id, status);
    return status;
  });

  const options = statusOptionsFor(ticket);

  const onChange = async (status: SupportStatus) => {
    if (status === ticket.status || change.pending) return;
    const changed = await change.run(status);
    if (!changed) return;
    toast.show(`Chamado: ${SUPPORT_STATUS_LABEL[changed].toLowerCase()}.`);
    onChanged();
  };

  return (
    <section aria-label="Situação do chamado" aria-busy={change.pending} className="rounded-3xl border border-line bg-surface/60 p-5">
      <SegmentedField
        legend="Situação"
        name="status"
        columns={ticket.internal ? 3 : 4}
        value={ticket.status}
        options={options}
        onChange={(status) => void onChange(status)}
      />
      {!ticket.internal && (
        <p className="mt-2 text-xs text-mist">O Jota vê a situação na hora. Quando ele responde um chamado aguardando, ele volta sozinho para pendente.</p>
      )}
      {change.error && (
        <div className="mt-3">
          <InlineError message={change.error.message} />
        </div>
      )}
    </section>
  );
}

const PRIORITY_OPTIONS = SUPPORT_PRIORITIES.map((value) => ({
  value,
  label: SUPPORT_PRIORITY_LABEL[value],
  icon: <span aria-hidden className={cn("size-2 rounded-full", PRIORITY_TONE[value].dot)} />,
  selectedClassName: PRIORITY_TONE[value].selected,
}));

/** O Jota ou a Lay trocam a prioridade de um chamado em aberto, mesmo que ele tenha sido aberto com outra. */
function PriorityControl({ ticket, role, onChanged }: { ticket: SupportTicket; role: SupportRole; onChanged: () => void }) {
  const toast = useToast();
  const change = useMutation(async (deps, priority: SupportPriority) => {
    await changeSupportPriority(deps, role, ticket, priority);
    return priority;
  });

  const onChange = async (priority: SupportPriority) => {
    if (priority === ticket.priority || change.pending) return;
    const changed = await change.run(priority);
    if (!changed) return;
    toast.show(`Prioridade: ${SUPPORT_PRIORITY_LABEL[changed].toLowerCase()}.`);
    onChanged();
  };

  return (
    <section aria-label="Prioridade do chamado" aria-busy={change.pending} className="rounded-3xl border border-line bg-surface/60 p-5">
      <SegmentedField
        legend="Prioridade"
        name="priority"
        columns={3}
        value={ticket.priority}
        options={PRIORITY_OPTIONS}
        onChange={(priority) => void onChange(priority)}
      />
      <p className="mt-2 text-xs text-mist">Aberto com uma prioridade e entendeu que é outra? Troque aqui; vale na hora para os dois.</p>
      {change.error && (
        <div className="mt-3">
          <InlineError message={change.error.message} />
        </div>
      )}
    </section>
  );
}

const VISIBILITY_OPTIONS = [
  { value: "internal", label: "Só eu", icon: <EyeOff aria-hidden className="size-4" /> },
  { value: "shared", label: "Eu e o Jota", icon: <Eye aria-hidden className="size-4" /> },
] as const;
type Visibility = (typeof VISIBILITY_OPTIONS)[number]["value"];

function VisibilityControl({ ticket, role, onChanged }: { ticket: SupportTicket; role: SupportRole; onChanged: () => void }) {
  const toast = useToast();
  const change = useMutation(async (deps, internal: boolean) => {
    await setSupportTicketVisibility(deps, role, ticket.id, internal);
    return internal;
  });
  // Esperando o Jota, o chamado precisa continuar visível para ele.
  const locked = ticket.status === "waiting";

  const onChange = async (value: Visibility) => {
    const internal = value === "internal";
    if (internal === ticket.internal || change.pending || locked) return;
    const changed = await change.run(internal);
    if (changed === undefined) return;
    toast.show(changed ? "Agora só você vê este chamado." : "O Jota agora vê este chamado.");
    onChanged();
  };

  return (
    <section aria-label="Quem vê o chamado" aria-busy={change.pending} className="rounded-3xl border border-line bg-surface/60 p-5">
      <SegmentedField
        legend="Quem vê"
        name="visibility"
        value={ticket.internal ? "internal" : "shared"}
        options={VISIBILITY_OPTIONS}
        onChange={(value) => void onChange(value)}
      />
      <p className="mt-2 text-xs text-mist">
        {locked
          ? "Está aguardando o Jota, então ele precisa ver. Mude a situação antes de esconder."
          : "“Só eu”: some do painel do Jota, com a conversa e os anexos."}
      </p>
      {change.error && (
        <div className="mt-3">
          <InlineError message={change.error.message} />
        </div>
      )}
    </section>
  );
}

/** Para o Jota: deixa claro quando a bola está com ele e deixa aprovar dali mesmo. */
function WaitingNotice({ ticket, role, onApproved }: { ticket: SupportTicket; role: SupportRole; onApproved: () => void }) {
  return (
    <section
      role="status"
      className="flex flex-col gap-3 rounded-2xl border border-amber-300/30 bg-amber-300/[0.08] px-4 py-3 text-sm text-amber-100 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="flex items-start gap-3">
        <Hourglass aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-300" />
        A Layra está esperando você analisar. Se estiver tudo certo, aprove e finalize; se faltar algo, responda abaixo e o chamado volta para a fila dela.
      </p>
      <ApproveTicketButton ticket={ticket} role={role} onApproved={onApproved} className="shrink-0" />
    </section>
  );
}

interface ReplyInput {
  body: string;
  replyToId: string | null;
  uploads: SupportUpload[];
  askAdmin: boolean;
  notifyAdmin: boolean;
}

interface ReplyFormProps {
  ticket: SupportTicket;
  role: SupportRole;
  /** Mensagem escolhida para responder; nula quando a resposta é para a conversa toda. */
  replyingTo: SupportQuote | null;
  onCancelReply: () => void;
  onSent: () => void;
}

function ReplyForm({ ticket, role, replyingTo, onCancelReply, onSent }: ReplyFormProps) {
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [body, setBody] = useState("");
  const [askAdmin, setAskAdmin] = useState(false);
  const [notifyAdmin, setNotifyAdmin] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const picked = usePickedFiles();
  const reply = useMutation(async (deps, input: ReplyInput) => {
    const result = await replyToSupportTicket(deps, role, ticket, { body: input.body, replyToId: input.replyToId }, input.uploads, {
      notifyAdmin: input.notifyAdmin,
    });
    if (input.askAdmin) await changeSupportStatus(deps, role, ticket.id, "waiting");
    return result;
  });
  const canAskAdmin = canChangeSupportStatus(role) && ticket.status !== "waiting" && !ticket.internal;
  const canNotify = canNotifyAdmin(ticket, role);

  // Escolheu uma mensagem para responder: o cursor já vai para o campo.
  useEffect(() => {
    if (replyingTo) formRef.current?.querySelector<HTMLTextAreaElement>('textarea[name="body"]')?.focus();
  }, [replyingTo]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!body.trim()) {
      setError("Escreva a resposta.");
      return;
    }
    setError(null);
    const sent = await reply.run({
      body,
      replyToId: replyingTo?.id ?? null,
      uploads: uploadsOf(picked.files),
      askAdmin: canAskAdmin && askAdmin,
      notifyAdmin: canNotify && notifyAdmin,
    });
    if (!sent) return;
    if (sent.failedUploads.length) toast.show(`Resposta enviada, mas não subiu: ${sent.failedUploads.join(", ")}.`, "error");
    if (!sent.notified) toast.show("Resposta enviada, mas o aviso no sininho do Jota falhou.", "error");
    setBody("");
    setAskAdmin(false);
    picked.clear();
    onCancelReply();
    onSent();
  };

  return (
    <form ref={formRef} noValidate onSubmit={onSubmit} aria-busy={reply.pending} className="rounded-3xl border border-line bg-surface/60 p-5">
      {replyingTo && <ReplyingTo quote={replyingTo} onCancel={onCancelReply} className="mb-4" />}
      <TextAreaField
        label="Responder"
        name="body"
        rows={4}
        maxLength={SUPPORT_TEXT_MAX}
        placeholder="Escreva uma atualização, uma dúvida ou mais detalhes."
        value={body}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && replyingTo) onCancelReply();
        }}
        onPaste={pasteFilesInto(picked.addFiles)}
        error={error ?? reply.error?.message}
      />
      <div className="mt-4">
        <AttachmentPicker files={picked.files} problem={picked.problem} onFiles={picked.addFiles} onRemove={picked.remove} disabled={reply.pending} />
      </div>
      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid gap-2">
          {canAskAdmin && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-fog">
              <input
                type="checkbox"
                checked={askAdmin}
                onChange={(event) => setAskAdmin(event.target.checked)}
                className="size-4 accent-[var(--color-electric)]"
              />
              Pedir resposta do Jota (muda para “Aguardando o Jota”)
            </label>
          )}
          {canNotify && <NotifyAdminCheckbox checked={notifyAdmin} onChange={setNotifyAdmin} disabled={reply.pending} />}
        </div>
        <Button type="submit" disabled={reply.pending} className="self-end">
          <Send aria-hidden className="size-4" /> {reply.pending ? "Enviando…" : "Enviar resposta"}
        </Button>
      </div>
    </form>
  );
}

/** Abrir a conversa marca o visto (e, para a Lay vendo novidade do Jota, avisa no sininho dele). No "ver como o Jota", não. */
function useMarkSeen(ticket: SupportTicket | null, role: SupportRole, onMarked: () => void) {
  const { previewing } = useAdminView();
  const mark = useMutation(async (deps, current: SupportTicket) => {
    const marking = markSupportTicketSeen(deps, role, current);
    if (!marking) return false;
    try {
      await marking;
      return true;
    } catch (error) {
      // O visto é secundário: a conversa continua usável, e o erro fica no console para investigar.
      console.error("Falha ao marcar o chamado como visto", error);
      throw error;
    }
  });
  const lastMarked = useRef<string | null>(null);
  const run = mark.run;
  useEffect(() => {
    if (!ticket || previewing) return;
    const stamp = `${ticket.id}:${ticket.updatedAt}:${ticket.replies.length}`;
    if (lastMarked.current === stamp) return;
    lastMarked.current = stamp;
    void run(ticket).then((marked) => {
      if (marked) onMarked();
    });
  }, [ticket, previewing, run, onMarked]);
}

const FLASH_MS = 1600;

/** Destaque rápido na mensagem aberta pela citação. */
function useFlash() {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return;
    const timer = window.setTimeout(() => setId(null), FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [id]);
  const show = useCallback((next: string) => setId(next), []);
  return { id, show };
}

interface TicketViewProps {
  ticket: SupportTicket;
  labels: readonly SupportLabel[];
  role: SupportRole;
  reload: () => void;
}

function TicketView({ ticket, labels, role, reload }: TicketViewProps) {
  const label = labels.find((item) => item.id === ticket.labelId);
  const other = counterpartOf(role);
  const otherSeenAt = seenAtBy(ticket, other);
  const seenOf = (authorRole: AdminRole | undefined, sentAt: string) =>
    authorRole === role && !ticket.internal
      ? { seen: wasSeenBy(ticket, other, sentAt), by: SUPPORT_ROLE_NAME[other], seenAt: otherSeenAt }
      : null;
  const attachmentsOf = (replyId: string | null) => ticket.attachments.filter((attachment) => attachment.replyId === replyId);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const replyingTo = quotedMessageOf(ticket, replyingToId);
  const flash = useFlash();
  const messageProps = (id: string) => ({
    id,
    highlighted: flash.id === id || replyingToId === id,
    onReply: () => setReplyingToId(id),
    onOpenQuote: (target: string) => scrollToMessage(target, flash.show),
  });
  return (
    <div className="mt-4 grid gap-6">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <SupportStatusBadge status={ticket.status} />
          {ticket.internal && <InternalBadge />}
          {wasApprovedByAdmin(ticket) && <ApprovedByAdminBadge />}
          <SupportPriorityBadge priority={ticket.priority} />
          <SupportKindBadge kind={ticket.kind} />
          <SupportAreaBadge area={ticket.area} />
          {label && !canManageSupportLabels(role) && <SupportLabelBadge label={label} />}
        </div>
        <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight break-words text-white sm:text-3xl">{ticket.title}</h1>
        <p className="mt-1.5 text-sm text-mist">
          Aberto por {authorNameOf(ticket.author)} em {formatDate(ticket.createdAt)}
          {ticket.resolvedAt && ` · finalizado em ${formatDate(ticket.resolvedAt)}`}
        </p>
        {!ticket.internal && (
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-mist">
            {otherSeenAt ? <Eye aria-hidden className="size-3.5 text-electric-soft" /> : <EyeOff aria-hidden className="size-3.5" />}
            {otherSeenAt
              ? `${SUPPORT_ROLE_NAME[other]} abriu este chamado pela última vez ${formatRelative(otherSeenAt)}`
              : `${SUPPORT_ROLE_NAME[other]} ainda não abriu este chamado`}
          </p>
        )}
      </header>

      {canChangeSupportStatus(role) && <StatusControl ticket={ticket} role={role} onChanged={reload} />}
      {canChangeSupportPriority(ticket, role) && <PriorityControl ticket={ticket} role={role} onChanged={reload} />}
      {canChangeSupportVisibility(role) && <VisibilityControl ticket={ticket} role={role} onChanged={reload} />}
      {canManageSupportLabels(role) && (
        <section aria-label="Etiqueta do chamado" className="flex flex-wrap items-center gap-3 rounded-3xl border border-line bg-surface/60 p-5">
          <span className="text-sm font-medium text-fog">Etiqueta</span>
          <LabelPicker
            ticketId={ticket.id}
            ticketTitle={ticket.title}
            labelId={ticket.labelId}
            labels={labels}
            role={role}
            onChanged={reload}
            className="w-full sm:w-64"
          />
          {labels.length === 0 && <span className="text-xs text-mist">Crie etiquetas no botão “Etiquetas” da lista do Suporte.</span>}
        </section>
      )}
      {role === "admin" && ticket.status === "waiting" && <WaitingNotice ticket={ticket} role={role} onApproved={reload} />}

      <section aria-labelledby="conversa">
        <h2 id="conversa" className="mb-3 text-xs font-semibold tracking-[0.16em] text-mist uppercase">
          Conversa
        </h2>
        <ol className="grid gap-4">
          <Message
            {...messageProps(SUPPORT_OPENING_ID)}
            author={ticket.author}
            body={ticket.description}
            createdAt={ticket.createdAt}
            attachments={attachmentsOf(null)}
            own={ticket.author?.role === role}
            seen={seenOf(ticket.author?.role, ticket.createdAt)}
          />
          {timelineOf(ticket).map((item) =>
            item.type === "status" ? (
              <StatusLine key={item.event.id} event={item.event} />
            ) : (
              <Message
                key={item.reply.id}
                {...messageProps(item.reply.id)}
                quote={item.reply.replyToId ? quotedMessageOf(ticket, item.reply.replyToId) : undefined}
                author={item.reply.author}
                body={item.reply.body}
                createdAt={item.reply.createdAt}
                attachments={attachmentsOf(item.reply.id)}
                own={item.reply.author?.role === role}
                seen={seenOf(item.reply.author?.role, item.reply.createdAt)}
              />
            ),
          )}
        </ol>
      </section>

      <ReplyForm ticket={ticket} role={role} replyingTo={replyingTo} onCancelReply={() => setReplyingToId(null)} onSent={reload} />
    </div>
  );
}

export default function SupportTicketPage() {
  const { id = "" } = useParams();
  // No modo "ver como o Jota" a tela é a dele: sem etiquetas para editar nem controle de situação.
  const role = supportRoleOf(useViewRole() ?? "admin");
  const ticket = useAdminQuery((deps) => findSupportTicket(deps, role, id), `admin-support-${id}-${role}`);
  useMarkSeen(ticket.status === "success" ? ticket.data : null, role, ticket.reload);
  const labels = useAdminQuery(listSupportLabels, "admin-support-labels");
  usePolling(ticket.reload, REFRESH_MS);
  const labelList = labels.status === "success" ? labels.data : [];

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
      {ticket.status === "success" && ticket.data && <TicketView ticket={ticket.data} labels={labelList} role={role} reload={ticket.reload} />}
    </>
  );
}
