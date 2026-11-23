import { BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import { nudgeAdminOnSupportTicket } from "@/application/support-use-cases";
import type { AdminRole } from "@/domain/admin-user";
import { activeNudgesOf, canNudgeAdmin, nextNudgeAt, waitingSinceOf, type SupportTicket } from "@/domain/support-ticket";
import { Button } from "@/ui/components/Button";
import { cn } from "@/ui/lib/cn";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useMutation } from "../hooks";
import { formatDate, formatRelative } from "../lib/dates";
import { useToast } from "../toast";

/** "agora", "há 2 h", "ontem" ou "em 20/11": cabe no meio de uma frase. */
const whenOf = (timestamp: string) => {
  const relative = formatRelative(timestamp);
  return /^\d/.test(relative) ? `em ${relative}` : relative;
};

const timeOf = (date: Date) => date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** Liga de novo quando passa o intervalo, sem precisar recarregar a página. */
function useNextNudgeAt(ticket: SupportTicket): Date | null {
  const [next, setNext] = useState(() => nextNudgeAt(ticket));
  useEffect(() => {
    const current = nextNudgeAt(ticket);
    setNext(current);
    if (!current) return;
    const timer = window.setTimeout(() => setNext(nextNudgeAt(ticket)), current.getTime() - Date.now() + 500);
    return () => window.clearTimeout(timer);
  }, [ticket]);
  return next;
}

function nudgeSummary(ticket: SupportTicket): string {
  const nudges = activeNudgesOf(ticket);
  const last = nudges.at(-1);
  if (!last) return "Você ainda não cobrou o Jota neste chamado.";
  const times = nudges.length === 1 ? "1 vez" : `${nudges.length} vezes`;
  return `Você já cobrou ${times}; a última foi ${whenOf(last.createdAt)}.`;
}

interface NudgeAdminSectionProps {
  ticket: SupportTicket;
  role: AdminRole;
  onNudged: () => void;
}

/**
 * Para a Lay, em chamado aguardando o Jota: "Cobrar o Jota" manda um aviso no sininho e no celular dele
 * dizendo que o chamado depende dele para conferir, aprovar e finalizar. Uma cobrança por hora.
 */
export function NudgeAdminSection({ ticket, role, onNudged }: NudgeAdminSectionProps) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const next = useNextNudgeAt(ticket);
  const nudge = useMutation((deps) => nudgeAdminOnSupportTicket(deps, role, ticket).then(() => true));

  if (!canNudgeAdmin(ticket, role)) return null;
  const waitingSince = waitingSinceOf(ticket);

  const onConfirm = async () => {
    const done = await nudge.run();
    setConfirming(false);
    if (!done) {
      toast.show(nudge.error?.message ?? "Não foi possível cobrar o Jota. Tente de novo.", "error");
      return;
    }
    toast.show("Jota cobrado: o aviso foi para o sininho e o celular dele.");
    onNudged();
  };

  return (
    <section
      aria-label="Cobrar o Jota"
      className="flex flex-col gap-3 rounded-3xl border border-amber-300/30 bg-amber-300/[0.06] p-5 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="text-sm">
        <p className="font-medium text-amber-100">Depende do Jota para conferir, aprovar e finalizar</p>
        <p className="mt-1 text-xs text-mist">
          {waitingSince && (
            <>
              Passou para “Aguardando o Jota”{" "}
              <time dateTime={waitingSince} title={formatDate(waitingSince)}>
                {whenOf(waitingSince)}
              </time>
              .{" "}
            </>
          )}
          {nudgeSummary(ticket)}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-stretch gap-1 sm:items-end">
        <Button
          variant="secondary"
          onClick={() => setConfirming(true)}
          disabled={next !== null || nudge.pending}
          className="border-amber-300/40 bg-amber-300/10 text-amber-100 hover:border-amber-300/60 hover:bg-amber-300/15"
        >
          <BellRing aria-hidden className="size-4" /> Cobrar o Jota
        </Button>
        {next && <span className="text-xs text-mist">Dá para cobrar de novo às {timeOf(next)}.</span>}
      </div>
      <ConfirmDialog
        open={confirming}
        title="Cobrar o Jota neste chamado?"
        description={
          <>
            O Jota recebe no sininho e no celular: <strong className="text-white">“Layra está cobrando: {ticket.title}”</strong>, avisando que o
            chamado depende dele para finalizar. Ele também vê a cobrança dentro do chamado.
          </>
        }
        confirmLabel="Cobrar agora"
        tone="positive"
        pending={nudge.pending}
        onConfirm={() => void onConfirm()}
        onClose={() => setConfirming(false)}
      />
    </section>
  );
}

/** Para o Jota, dentro do aviso de "aguardando você": quantas vezes a Layra já cobrou. */
export function NudgedNotice({ ticket, className }: { ticket: SupportTicket; className?: string }) {
  const nudges = activeNudgesOf(ticket);
  const last = nudges.at(-1);
  if (!last) return null;
  const times = nudges.length === 1 ? "" : ` (${nudges.length} vezes)`;
  return (
    <p className={cn("flex items-center gap-2 text-sm font-medium text-[#ffd0d0]", className)}>
      <BellRing aria-hidden className="size-4 shrink-0 text-alert" />
      A Layra cobrou você neste chamado {whenOf(last.createdAt)}
      {times}.
    </p>
  );
}

/** Na lista: "Cobrado 2x" em chamado aguardando o Jota que a Layra já cobrou. */
export function NudgedBadge({ ticket }: { ticket: SupportTicket }) {
  const nudges = activeNudgesOf(ticket);
  const last = nudges.at(-1);
  if (!last) return null;
  return (
    <span
      title={`Última cobrança ${formatDate(last.createdAt)}`}
      className="inline-flex items-center gap-1 rounded-full border border-alert/40 bg-alert/10 px-2 py-0.5 text-[0.68rem] font-semibold text-[#ff9a9a]"
    >
      <BellRing aria-hidden className="size-3" />
      {nudges.length === 1 ? "Cobrado" : `Cobrado ${nudges.length}x`}
    </span>
  );
}
