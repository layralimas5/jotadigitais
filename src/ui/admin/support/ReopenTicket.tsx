import { RotateCcw } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { SUPPORT_TEXT_MAX } from "@/application/schemas";
import { reopenSupportTicket } from "@/application/support-use-cases";
import { canReopenSupportTicket, reopenDeadlineOf, type SupportRole, type SupportTicket } from "@/domain/support-ticket";
import { Button } from "@/ui/components/Button";
import { InlineError } from "../components/AdminUi";
import { useMutation } from "../hooks";
import { formatIsoDate, localIsoDate } from "../lib/dates";
import { useToast } from "../toast";

interface ReopenTicketProps {
  ticket: SupportTicket;
  role: SupportRole;
  onReopened: () => void;
}

/**
 * Chamado finalizado há até 7 dias: o Jota reabre o mesmo, contando o que voltou a acontecer,
 * em vez de abrir outro. O motivo vai na conversa e a Layra é avisada.
 */
export function ReopenTicket({ ticket, role, onReopened }: ReopenTicketProps) {
  const toast = useToast();
  const textareaId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const reopen = useMutation(async (deps, text: string) => {
    await reopenSupportTicket(deps, role, ticket, text);
    return true;
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  if (!canReopenSupportTicket(ticket, role)) return null;
  const deadline = reopenDeadlineOf(ticket);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!(await reopen.run(reason))) return;
    setOpen(false);
    setReason("");
    toast.show("Chamado reaberto. A Layra foi avisada.");
    onReopened();
  };

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface/60 px-4 py-3 text-sm text-fog sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-start gap-3">
        <RotateCcw aria-hidden className="mt-0.5 size-4 shrink-0 text-electric-soft" />
        <span>
          O problema voltou? Reabra este mesmo chamado, com o histórico junto.
          {deadline && <span className="text-mist"> Dá para reabrir até {formatIsoDate(localIsoDate(deadline))}.</span>}
        </span>
      </p>
      <Button variant="secondary" onClick={() => setOpen(true)} className="shrink-0">
        <RotateCcw aria-hidden className="size-4" /> Reabrir chamado
      </Button>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        aria-labelledby={`${textareaId}-title`}
        className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-3xl border border-line-strong bg-surface p-6 text-white backdrop:bg-black/70 backdrop:backdrop-blur-sm"
      >
        <form onSubmit={(event) => void onSubmit(event)} className="space-y-4">
          <div>
            <h2 id={`${textareaId}-title`} className="font-display text-lg font-semibold">
              Reabrir chamado
            </h2>
            <p className="mt-1 text-sm text-mist">Conte o que voltou a acontecer. A mensagem vai na conversa e a Layra recebe o aviso.</p>
          </div>
          <label htmlFor={textareaId} className="sr-only">
            O que voltou a acontecer
          </label>
          <textarea
            id={textareaId}
            autoFocus
            rows={4}
            maxLength={SUPPORT_TEXT_MAX}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ex.: o filtro de país voltou a mostrar contas de todos os países."
            className="w-full resize-y rounded-xl border border-line-strong bg-ink px-3.5 py-2.5 text-sm text-white placeholder:text-mist/70 focus:border-electric focus:outline-none"
          />
          {reopen.error && <InlineError message={reopen.error.message} />}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={reopen.pending}>
              Voltar
            </Button>
            <Button type="submit" disabled={reopen.pending || !reason.trim()}>
              <RotateCcw aria-hidden className="size-4" /> {reopen.pending ? "Reabrindo…" : "Reabrir"}
            </Button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
