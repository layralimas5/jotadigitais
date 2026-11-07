import { Trash2 } from "lucide-react";
import { useState } from "react";
import { deleteSupportTicket } from "@/application/support-use-cases";
import type { AdminRole } from "@/domain/admin-user";
import type { SupportTicket } from "@/domain/support-ticket";
import { Button } from "@/ui/components/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useMutation } from "../hooks";
import { useToast } from "../toast";

/** Apagar o chamado inteiro (conversa, anexos e andamento), com confirmação. Só aparece para a desenvolvedora. */
export function DeleteTicketButton({ ticket, role, onDeleted }: { ticket: SupportTicket; role: AdminRole; onDeleted: () => void }) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const remove = useMutation((deps) => deleteSupportTicket(deps, role, ticket.id).then(() => true));

  const onConfirm = async () => {
    const done = await remove.run();
    setConfirming(false);
    if (!done) {
      toast.show(remove.error?.message ?? "Não foi possível apagar o chamado. Tente de novo.", "error");
      return;
    }
    toast.show(`Chamado “${ticket.title}” apagado.`);
    onDeleted();
  };

  const files = ticket.attachments.length;
  return (
    <>
      <Button variant="ghost" onClick={() => setConfirming(true)} className="text-[#ff9a9a] hover:bg-alert/10 hover:text-[#ffb3b3]">
        <Trash2 aria-hidden className="size-4" /> Apagar chamado
      </Button>
      <ConfirmDialog
        open={confirming}
        title="Apagar este chamado?"
        description={
          <>
            <strong className="text-white">{ticket.title}</strong> some para os dois, com a conversa, o andamento
            {files > 0 ? ` e ${files} ${files === 1 ? "anexo" : "anexos"}` : ""}. Não dá para desfazer.
          </>
        }
        confirmLabel="Apagar chamado"
        pending={remove.pending}
        onConfirm={() => void onConfirm()}
        onClose={() => setConfirming(false)}
      />
    </>
  );
}
