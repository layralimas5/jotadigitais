import { ChevronDown, Layers, Unlink } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { unmergeSupportTicket } from "@/application/support-use-cases";
import { canMergeSupportTickets, type SupportAttachment, type SupportAuthor, type SupportRole, type SupportTicket } from "@/domain/support-ticket";
import { Button } from "@/ui/components/Button";
import { cn } from "@/ui/lib/cn";
import { InlineError } from "../components/AdminUi";
import { PersonAvatar } from "../components/PersonAvatar";
import { RoleBadge } from "../components/RoleBadge";
import { useMutation } from "../hooks";
import { formatDate, formatRelative } from "../lib/dates";
import { useToast } from "../toast";
import { AttachmentGallery } from "./AttachmentGallery";
import { authorNameOf, SupportStatusBadge } from "./SupportBadges";

/** Separa o chamado juntado: ele volta para a lista como estava. */
function useUnmerge(ticket: SupportTicket, onChanged: () => void) {
  const toast = useToast();
  const unmerge = useMutation(async (deps, role: SupportRole) => {
    await unmergeSupportTicket(deps, role, ticket.id);
    return true;
  });
  const run = async (role: SupportRole) => {
    if (!(await unmerge.run(role))) return;
    toast.show(`“${ticket.title}” separado. Ele voltou para a lista do Suporte.`);
    onChanged();
  };
  return { run, pending: unmerge.pending, error: unmerge.error };
}

function UnmergeButton({ ticket, role, onChanged }: { ticket: SupportTicket; role: SupportRole; onChanged: () => void }) {
  const unmerge = useUnmerge(ticket, onChanged);
  const [confirming, setConfirming] = useState(false);
  if (!canMergeSupportTickets(role)) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {confirming ? (
        <>
          <span className="text-fog">Separar este chamado?</span>
          <Button variant="secondary" onClick={() => void unmerge.run(role)} disabled={unmerge.pending} className="h-8 px-3 text-xs">
            {unmerge.pending ? "Separando…" : "Separar"}
          </Button>
          <button type="button" onClick={() => setConfirming(false)} className="text-mist hover:text-white">
            Não
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="inline-flex items-center gap-1.5 text-mist hover:text-white">
          <Unlink aria-hidden className="size-3.5" /> Separar
        </button>
      )}
      {unmerge.error && <InlineError message={unmerge.error.message} />}
    </div>
  );
}

function ReadOnlyMessage({ author, body, createdAt, attachments }: { author: SupportAuthor | null; body: string; createdAt: string; attachments: SupportAttachment[] }) {
  const name = authorNameOf(author);
  return (
    <li className="flex gap-3">
      <PersonAvatar name={name} src={author?.avatarUrl} />
      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-line bg-ink/40 p-3">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-white">{name}</span>
          {author && <RoleBadge role={author.role} />}
          <time dateTime={createdAt} title={formatDate(createdAt)} className="text-xs text-mist">
            {formatRelative(createdAt)}
          </time>
        </p>
        <p className="mt-1.5 text-sm leading-relaxed break-words whitespace-pre-wrap text-fog">{body}</p>
        <AttachmentGallery attachments={attachments} />
      </div>
    </li>
  );
}

function MergedTicketCard({ ticket, role, onChanged }: { ticket: SupportTicket; role: SupportRole; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const panelId = `juntado-${ticket.id}`;
  const attachmentsOf = (replyId: string | null) => ticket.attachments.filter((attachment) => attachment.replyId === replyId);
  return (
    <li className="rounded-2xl border border-line bg-surface/60">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-white">{ticket.title}</span>
          <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-mist">
            <SupportStatusBadge status={ticket.status} />
            {authorNameOf(ticket.author)} · aberto em {formatDate(ticket.createdAt)} · {ticket.replies.length} {ticket.replies.length === 1 ? "resposta" : "respostas"}
          </span>
        </span>
        <ChevronDown aria-hidden className={cn("mt-1 size-5 shrink-0 text-mist transition-transform", open && "rotate-180 text-white")} />
      </button>
      {open && (
        <div id={panelId} className="space-y-3 border-t border-line p-4">
          <ol className="grid gap-3">
            <ReadOnlyMessage author={ticket.author} body={ticket.description} createdAt={ticket.createdAt} attachments={attachmentsOf(null)} />
            {ticket.replies.map((reply) => (
              <ReadOnlyMessage key={reply.id} author={reply.author} body={reply.body} createdAt={reply.createdAt} attachments={attachmentsOf(reply.id)} />
            ))}
          </ol>
          <UnmergeButton ticket={ticket} role={role} onChanged={onChanged} />
        </div>
      )}
    </li>
  );
}

/** Chamados juntados neste: cada um abre a conversa inteira dele, só para leitura. */
export function MergedTicketsSection({ ticket, role, onChanged }: { ticket: SupportTicket; role: SupportRole; onChanged: () => void }) {
  if (ticket.merged.length === 0) return null;
  return (
    <section aria-labelledby="juntados" className="space-y-3">
      <h2 id="juntados" className="flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-mist uppercase">
        <Layers aria-hidden className="size-4" /> Chamados juntados neste ({ticket.merged.length})
      </h2>
      <p className="text-xs text-mist">Pediam a mesma coisa. A conversa continua aqui embaixo, no chamado principal.</p>
      <ul className="grid gap-2">
        {ticket.merged.map((child) => (
          <MergedTicketCard key={child.id} ticket={child} role={role} onChanged={onChanged} />
        ))}
      </ul>
    </section>
  );
}

/** Chamado que foi juntado a outro: aponta para o principal, onde a conversa continua. */
export function MergedIntoNotice({ ticket, role, onChanged }: { ticket: SupportTicket; role: SupportRole; onChanged: () => void }) {
  if (!ticket.mergedInto) return null;
  return (
    <section className="flex flex-col gap-3 rounded-3xl border border-electric/30 bg-electric/[0.06] p-5 sm:flex-row sm:items-center">
      <Layers aria-hidden className="size-5 shrink-0 text-electric" />
      <p className="flex-1 text-sm text-fog">
        Este chamado foi juntado a outro que pede a mesma coisa{ticket.mergedAt ? ` (${formatRelative(ticket.mergedAt)})` : ""}. A conversa continua no
        chamado principal.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Link to={`/admin/suporte/${ticket.mergedInto}`} className="text-sm font-semibold text-electric-soft hover:underline">
          Abrir o principal
        </Link>
        <UnmergeButton ticket={ticket} role={role} onChanged={onChanged} />
      </div>
    </section>
  );
}
