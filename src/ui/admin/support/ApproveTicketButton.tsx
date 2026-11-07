import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { approveSupportTicket } from "@/application/support-use-cases";
import type { AdminRole } from "@/domain/admin-user";
import { canApproveSupportTicket, type SupportTicket } from "@/domain/support-ticket";
import { Button } from "@/ui/components/Button";
import { cn } from "@/ui/lib/cn";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useMutation } from "../hooks";
import { useToast } from "../toast";

interface ApproveTicketButtonProps {
  ticket: SupportTicket;
  role: AdminRole;
  onApproved: () => void;
  className?: string;
}

/** Para o Jota: aprova e finaliza o chamado que está esperando por ele, com confirmação. */
export function ApproveTicketButton({ ticket, role, onApproved, className }: ApproveTicketButtonProps) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const approve = useMutation((deps) => approveSupportTicket(deps, role, ticket).then(() => true));

  if (!canApproveSupportTicket(ticket, role)) return null;

  const onConfirm = async () => {
    const done = await approve.run();
    setConfirming(false);
    if (!done) {
      toast.show(approve.error?.message ?? "Não foi possível aprovar o chamado. Tente de novo.", "error");
      return;
    }
    toast.show(`Chamado “${ticket.title}” aprovado e finalizado.`);
    onApproved();
  };

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => setConfirming(true)}
        className={cn("border-emerald-400/40 bg-emerald-400/10 text-emerald-200 hover:border-emerald-300/60 hover:bg-emerald-400/15", className)}
      >
        <CheckCircle2 aria-hidden className="size-4" /> Aprovado e finalizado
      </Button>
      <ConfirmDialog
        open={confirming}
        title="Aprovar e finalizar este chamado?"
        description={
          <>
            <strong className="text-white">{ticket.title}</strong> vai para Finalizados, e a Layra vê que você analisou e aprovou. Se
            ainda faltar algo, responda o chamado em vez de aprovar.
          </>
        }
        confirmLabel="Aprovar e finalizar"
        tone="positive"
        pending={approve.pending}
        onConfirm={() => void onConfirm()}
        onClose={() => setConfirming(false)}
      />
    </>
  );
}
