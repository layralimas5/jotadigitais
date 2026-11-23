import { AlertTriangle, Siren } from "lucide-react";
import { Link } from "react-router-dom";
import { listSupportTickets } from "@/application/support-use-cases";
import { isOpenUrgent } from "@/domain/support-ticket";
import { Button } from "@/ui/components/Button";
import { Modal } from "../components/Modal";
import { useAdminQuery } from "../hooks";

interface UrgentConfirmDialogProps {
  open: boolean;
  /** Chamado que está sendo marcado urgente; fica fora da contagem da fila. Nulo para chamado novo. */
  currentTicketId: string | null;
  pending?: boolean;
  onConfirmUrgent: () => void;
  onChooseNormal: () => void;
  onClose: () => void;
}

const LISTED_URGENTS = 4;

function UrgentQueue({ currentTicketId }: { currentTicketId: string | null }) {
  const tickets = useAdminQuery((deps) => listSupportTickets(deps, "admin"), "admin-support-urgent-queue");
  if (tickets.status === "loading") return <p className="text-sm text-mist">Conferindo a fila de urgentes…</p>;
  if (tickets.status === "error") return null;
  const urgents = tickets.data.filter((ticket) => ticket.id !== currentTicketId && isOpenUrgent(ticket));

  if (urgents.length === 0) {
    return <p className="text-sm text-mist">Hoje não tem nenhum outro chamado urgente na fila.</p>;
  }
  return (
    <div className="rounded-2xl border border-alert/30 bg-alert/[0.07] p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-[#ffd0d0]">
        <Siren aria-hidden className="size-4 shrink-0" />
        {urgents.length === 1 ? "Já tem 1 chamado urgente na fila:" : `Já tem ${urgents.length} chamados urgentes na fila:`}
      </p>
      <ul className="mt-2 grid gap-1 text-sm text-fog">
        {urgents.slice(0, LISTED_URGENTS).map((ticket) => (
          <li key={ticket.id} className="truncate">
            <Link to={`/admin/suporte/${ticket.id}`} target="_blank" className="hover:text-white hover:underline">
              • {ticket.title}
            </Link>
          </li>
        ))}
        {urgents.length > LISTED_URGENTS && <li className="text-mist">e mais {urgents.length - LISTED_URGENTS}.</li>}
      </ul>
      <p className="mt-2 text-xs text-mist">Cada urgente novo empurra esses para trás.</p>
    </div>
  );
}

/**
 * Card no meio da tela quando o Jota marca um chamado como urgente: confirma se é mesmo urgente e mostra
 * quantos urgentes já estão na fila, para urgente voltar a significar urgente.
 */
export function UrgentConfirmDialog({ open, currentTicketId, pending, onConfirmUrgent, onChooseNormal, onClose }: UrgentConfirmDialogProps) {
  return (
    <Modal open={open} placement="center" title="É realmente urgente?" onClose={onClose}>
      <div className="grid gap-4">
        <p className="flex items-start gap-3 text-sm leading-relaxed text-fog">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-alert" />
          <span>
            Urgente é o que está <strong className="text-white">parando venda, pagamento ou entrega agora</strong>. Ajuste visual, texto ou
            melhoria entra como normal e sai na ordem da fila.
          </span>
        </p>
        <UrgentQueue currentTicketId={currentTicketId} />
        <p className="text-sm text-white">Deseja adicionar mais um chamado na fila de urgentes?</p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onChooseNormal} disabled={pending}>
            Não, deixar como normal
          </Button>
          <Button onClick={onConfirmUrgent} disabled={pending} className="bg-alert text-white shadow-none hover:bg-[#ff4d4d] hover:shadow-none">
            {pending ? "Aguarde…" : "Sim, é urgente"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
