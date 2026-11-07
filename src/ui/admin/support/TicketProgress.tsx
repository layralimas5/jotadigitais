import { ArrowRight, CircleDot, MessageSquare, Paperclip, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { SUPPORT_STATUS_LABEL, timelineOf, type SupportStatusEvent, type SupportTicket } from "@/domain/support-ticket";
import { cn } from "@/ui/lib/cn";
import { formatDate, formatRelative } from "../lib/dates";
import { authorNameOf, STATUS_TONE } from "./SupportBadges";

/** Quantas movimentações recentes cabem no resumo; o resto fica na conversa completa. */
const RECENT_ITEMS = 6;

export function statusEventText(event: SupportStatusEvent): string {
  const to = SUPPORT_STATUS_LABEL[event.to].toLowerCase();
  if (!event.author) return `Voltou para ${to} quando o Jota respondeu`;
  return `${authorNameOf(event.author)} mudou para ${to}`;
}

function Step({ icon, children, at, tone }: { icon: ReactNode; children: ReactNode; at: string; tone?: string }) {
  return (
    <li className="group/step relative flex gap-3 pb-4 last:pb-0">
      <span aria-hidden className="absolute top-7 bottom-0 left-[0.85rem] w-px bg-line group-last/step:hidden" />
      <span className={cn("relative grid size-7 shrink-0 place-items-center rounded-full border bg-ink", tone ?? "border-line-strong text-mist")}>{icon}</span>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="text-sm text-fog">{children}</div>
        <time dateTime={at} title={formatDate(at)} className="text-xs text-mist">
          {formatRelative(at)}
        </time>
      </div>
    </li>
  );
}

/** O andamento do chamado em uma olhada: aberto, trocas de situação e as últimas mensagens. */
export function TicketProgress({ ticket }: { ticket: SupportTicket }) {
  const timeline = timelineOf(ticket);
  const recent = timeline.slice(-RECENT_ITEMS);
  const hidden = timeline.length - recent.length;
  const files = ticket.attachments.length;

  return (
    <div className="space-y-4">
      <ol aria-label="Andamento">
        <Step icon={<CircleDot className="size-3.5" />} at={ticket.createdAt}>
          <strong className="font-semibold text-white">{authorNameOf(ticket.author)}</strong> abriu o chamado
          {files > 0 && (
            <span className="ml-1.5 inline-flex items-center gap-1 text-xs text-mist">
              <Paperclip aria-hidden className="size-3" /> {files} {files === 1 ? "anexo" : "anexos"}
            </span>
          )}
        </Step>
        {hidden > 0 && (
          <li className="pb-4 pl-10 text-xs text-mist">
            + {hidden} {hidden === 1 ? "movimentação anterior" : "movimentações anteriores"}
          </li>
        )}
        {recent.map((item) =>
          item.type === "status" ? (
            <Step key={item.event.id} icon={<RefreshCw className="size-3.5" />} at={item.at} tone={STATUS_TONE[item.event.to]}>
              {statusEventText(item.event)}
            </Step>
          ) : (
            <Step key={item.reply.id} icon={<MessageSquare className="size-3.5" />} at={item.at}>
              <strong className="font-semibold text-white">{authorNameOf(item.reply.author)}:</strong>{" "}
              <span className="line-clamp-2 break-words">{item.reply.body}</span>
            </Step>
          ),
        )}
      </ol>
      <Link
        to={`/admin/suporte/${ticket.id}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-electric-soft underline-offset-4 hover:underline"
      >
        Abrir conversa completa <ArrowRight aria-hidden className="size-4" />
      </Link>
    </div>
  );
}
