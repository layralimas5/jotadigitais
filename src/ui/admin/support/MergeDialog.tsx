import { Layers, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { mergeSupportTickets } from "@/application/support-use-cases";
import { suggestedMergeTarget, type SupportRole, type SupportTicket } from "@/domain/support-ticket";
import { Button } from "@/ui/components/Button";
import { cn } from "@/ui/lib/cn";
import { InlineError } from "../components/AdminUi";
import { useMutation } from "../hooks";
import { formatDate } from "../lib/dates";
import { authorNameOf, SupportStatusBadge } from "./SupportBadges";

interface MergeFormProps {
  tickets: readonly SupportTicket[];
  role: SupportRole;
  titleId: string;
  onClose: () => void;
  onMerged: (target: SupportTicket, count: number) => void;
}

function MergeForm({ tickets, role, titleId, onClose, onMerged }: MergeFormProps) {
  const [targetId, setTargetId] = useState(() => suggestedMergeTarget(tickets)?.id ?? "");
  const merge = useMutation(async (deps, target: string, sources: string[]) => {
    await mergeSupportTickets(deps, role, target, sources);
    return true;
  });
  const target = tickets.find((ticket) => ticket.id === targetId);
  const sources = tickets.filter((ticket) => ticket.id !== targetId);

  const confirm = async () => {
    if (!target) return;
    if (await merge.run(target.id, sources.map((ticket) => ticket.id))) onMerged(target, sources.length);
  };

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id={titleId} className="flex items-center gap-2 font-display text-lg font-semibold">
            <Layers aria-hidden className="size-5 text-electric" /> Juntar {tickets.length} chamados
          </h2>
          <p className="mt-1 text-sm text-mist">Escolha o principal. Os outros entram nele com a conversa inteira e saem da lista.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar" className="grid size-9 shrink-0 place-items-center rounded-full text-mist hover:bg-white/[0.06] hover:text-white">
          <X aria-hidden className="size-4" />
        </button>
      </div>

      <fieldset className="mt-5">
        <legend className="mb-2 text-sm font-medium text-fog">Chamado principal</legend>
        <div className="grid gap-2">
          {tickets.map((ticket) => {
            const checked = ticket.id === targetId;
            return (
              <label
                key={ticket.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-electric",
                  checked ? "border-electric bg-electric/10" : "border-line hover:border-line-strong",
                )}
              >
                <input type="radio" name="merge-target" value={ticket.id} checked={checked} onChange={() => setTargetId(ticket.id)} className="mt-1 accent-[#2799ff]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-white">{ticket.title}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-mist">
                    <SupportStatusBadge status={ticket.status} />
                    {authorNameOf(ticket.author)} · {formatDate(ticket.createdAt)} · {ticket.replies.length} {ticket.replies.length === 1 ? "resposta" : "respostas"}
                    {ticket.merged.length > 0 && ` · já tem ${ticket.merged.length} juntado${ticket.merged.length > 1 ? "s" : ""}`}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <p className="mt-4 text-xs leading-relaxed text-mist">
        Nada é apagado: dá para separar depois, dentro do principal. Se algum desses for do Jota e o principal estiver só com você, o principal passa a
        aparecer para ele também.
      </p>
      {merge.error && <InlineError message={merge.error.message} />}

      <div className="mt-5 flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onClose} disabled={merge.pending}>
          Cancelar
        </Button>
        <Button onClick={() => void confirm()} disabled={merge.pending || !target}>
          {merge.pending ? "Juntando…" : `Juntar em “${target?.title ?? ""}”`}
        </Button>
      </div>
    </>
  );
}

interface MergeDialogProps {
  /** Chamados escolhidos; nulo com a janela fechada. */
  tickets: readonly SupportTicket[] | null;
  role: SupportRole;
  onClose: () => void;
  onMerged: (target: SupportTicket, count: number) => void;
}

/** Confirmação de juntar: escolhe o principal entre os marcados. `<dialog>` nativo: Esc fecha e o foco volta. */
export function MergeDialog({ tickets, role, onClose, onMerged }: MergeDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (tickets && !dialog.open) dialog.showModal();
    if (!tickets && dialog.open) dialog.close();
  }, [tickets]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby={titleId}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(36rem,calc(100vw-2rem))] overflow-y-auto rounded-3xl border border-line-strong bg-surface p-6 text-white backdrop:bg-black/70 backdrop:backdrop-blur-sm max-sm:mb-0 max-sm:max-h-[92dvh] max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:p-4 max-sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))] max-sm:open:animate-[sheet-up_0.25s_var(--ease-out-expo)]"
    >
      {tickets && <MergeForm key={tickets.map((ticket) => ticket.id).join()} tickets={tickets} role={role} titleId={titleId} onClose={onClose} onMerged={onMerged} />}
    </dialog>
  );
}
