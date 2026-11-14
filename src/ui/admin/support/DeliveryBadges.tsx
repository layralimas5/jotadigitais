import { checklistProgressOf, isOverdue, type SupportTicket } from "@/domain/support-ticket";
import { localIsoDate } from "../lib/dates";
import { ChecklistBadge, DueDateBadge, ReleasedBadge } from "./SupportBadges";

/** Andamento da entrega numa olhada: "2 de 3", previsão (vencida em âmbar) ou "No ar desde". */
export function DeliveryBadges({ ticket }: { ticket: Pick<SupportTicket, "checklist" | "dueDate" | "releasedAt" | "status"> }) {
  const progress = checklistProgressOf(ticket);
  return (
    <>
      {progress.total > 0 && <ChecklistBadge done={progress.done} total={progress.total} />}
      {ticket.releasedAt ? (
        <ReleasedBadge releasedAt={ticket.releasedAt} />
      ) : (
        ticket.dueDate && ticket.status !== "done" && <DueDateBadge dueDate={ticket.dueDate} overdue={isOverdue(ticket, localIsoDate())} />
      )}
    </>
  );
}
