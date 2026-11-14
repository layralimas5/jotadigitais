import { CalendarClock, Check, ListChecks, Plus, Rocket, Undo2, X } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import {
  addSupportChecklistItems,
  removeSupportChecklistItem,
  setSupportDueDate,
  setSupportReleased,
  toggleSupportChecklistItem,
} from "@/application/support-use-cases";
import { checklistProgressOf, isOverdue, type SupportChecklistItem, type SupportRole, type SupportTicket } from "@/domain/support-ticket";
import { Button } from "@/ui/components/Button";
import { cn } from "@/ui/lib/cn";
import { InlineError } from "../components/AdminUi";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useMutation } from "../hooks";
import { formatDate, formatIsoDate, localIsoDate } from "../lib/dates";
import { useToast } from "../toast";
import { DueDateBadge, ReleasedBadge } from "./SupportBadges";

interface DeliveryProps {
  ticket: SupportTicket;
  role: SupportRole;
  onChanged: () => void;
}

const rowClass = "flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4";

function ProgressBar({ done, total }: { done: number; total: number }) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      aria-label={`${done} de ${total} itens feitos`}
      className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]"
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", done === total ? "bg-emerald-400" : "bg-electric")}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

/** Previsão de entrega: a desenvolvedora escolhe a data; o Jota vê. */
function DueDateRow({ ticket, role, editable, onChanged }: DeliveryProps & { editable: boolean }) {
  const inputId = useId();
  const toast = useToast();
  const save = useMutation(async (deps, dueDate: string | null) => {
    await setSupportDueDate(deps, role, ticket.id, dueDate);
    return true;
  });
  const overdue = isOverdue(ticket, localIsoDate());

  const change = async (dueDate: string | null) => {
    if (dueDate === ticket.dueDate) return;
    if (!(await save.run(dueDate))) return;
    toast.show(dueDate ? `Previsão: ${formatIsoDate(dueDate)}` : "Previsão retirada.");
    onChanged();
  };

  if (!editable) {
    return (
      <div className={rowClass}>
        <span className="flex items-center gap-2 text-sm text-fog">
          <CalendarClock aria-hidden className="size-4 text-mist" /> Previsão de entrega
        </span>
        {ticket.dueDate ? <DueDateBadge dueDate={ticket.dueDate} overdue={overdue} /> : <span className="text-sm text-mist">Ainda sem previsão</span>}
      </div>
    );
  }

  return (
    <div className={rowClass}>
      <label htmlFor={inputId} className="flex items-center gap-2 text-sm text-fog">
        <CalendarClock aria-hidden className="size-4 text-mist" /> Previsão de entrega
      </label>
      <div className="flex items-center gap-2">
        {ticket.dueDate && overdue && <DueDateBadge dueDate={ticket.dueDate} overdue />}
        <input
          id={inputId}
          type="date"
          value={ticket.dueDate ?? ""}
          min={localIsoDate()}
          disabled={save.pending}
          onChange={(event) => void change(event.target.value || null)}
          className="h-10 rounded-xl border border-line-strong bg-ink px-3 text-sm text-white [color-scheme:dark] focus:border-electric focus:outline-none disabled:opacity-60"
        />
        {ticket.dueDate && (
          <button
            type="button"
            onClick={() => void change(null)}
            disabled={save.pending}
            aria-label="Tirar a previsão"
            className="grid size-9 place-items-center rounded-full text-mist hover:bg-white/[0.06] hover:text-white"
          >
            <X aria-hidden className="size-4" />
          </button>
        )}
      </div>
      {save.error && <InlineError message={save.error.message} />}
    </div>
  );
}

/** "Já está no ar": avisa o Jota e passa o chamado para ele conferir e aprovar. */
function ReleaseRow({ ticket, role, editable, onChanged }: DeliveryProps & { editable: boolean }) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const release = useMutation(async (deps, released: boolean) => {
    await setSupportReleased(deps, role, ticket.id, released);
    return true;
  });

  const run = async (released: boolean) => {
    const ok = await release.run(released);
    setConfirming(false);
    if (!ok) return;
    toast.show(released ? (ticket.internal ? "Marcado como no ar." : "Marcado como no ar. O Jota foi avisado.") : "Selo de publicado retirado.");
    onChanged();
  };

  return (
    <div className={rowClass}>
      <span className="flex items-center gap-2 text-sm text-fog">
        <Rocket aria-hidden className="size-4 text-mist" /> Publicação
      </span>
      {ticket.releasedAt ? (
        <span className="flex items-center gap-2">
          <ReleasedBadge releasedAt={ticket.releasedAt} />
          {editable && (
            <button
              type="button"
              onClick={() => void run(false)}
              disabled={release.pending}
              className="inline-flex items-center gap-1 text-xs text-mist hover:text-white"
              title={`Marcado em ${formatDate(ticket.releasedAt)}`}
            >
              <Undo2 aria-hidden className="size-3.5" /> Desmarcar
            </button>
          )}
        </span>
      ) : editable ? (
        <Button onClick={() => setConfirming(true)} disabled={release.pending || ticket.status === "done"}>
          <Rocket aria-hidden className="size-4" /> Marcar como no ar
        </Button>
      ) : (
        <span className="text-sm text-mist">Ainda não publicado</span>
      )}
      {release.error && <InlineError message={release.error.message} />}
      <ConfirmDialog
        open={confirming}
        title="Já está no ar?"
        tone="positive"
        description={
          ticket.internal
            ? "O chamado ganha o selo de publicado."
            : "O chamado ganha o selo “No ar”, o Jota recebe o aviso no sininho e, se estava na sua fila, passa para “Aguardando o Jota” para ele conferir e aprovar."
        }
        confirmLabel="Marcar como no ar"
        pending={release.pending}
        onConfirm={() => void run(true)}
        onClose={() => setConfirming(false)}
      />
    </div>
  );
}

function ChecklistRow({ item, editable, busy, onToggle, onRemove }: {
  item: SupportChecklistItem;
  editable: boolean;
  busy: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const mark = (
    <span
      aria-hidden
      className={cn(
        "grid size-5 shrink-0 place-items-center rounded-md border transition-colors",
        item.done ? "border-emerald-400 bg-emerald-400 text-ink" : "border-line-strong",
      )}
    >
      {item.done && <Check className="size-3.5" strokeWidth={3} />}
    </span>
  );
  const text = <span className={cn("min-w-0 flex-1 text-sm break-words", item.done ? "text-mist line-through decoration-mist/60" : "text-white")}>{item.body}</span>;

  if (!editable) {
    return (
      <li className="flex items-start gap-3 py-1.5">
        {mark}
        {text}
        <span className="sr-only">{item.done ? "feito" : "a fazer"}</span>
      </li>
    );
  }
  return (
    <li className="group flex items-start gap-1">
      <button
        type="button"
        role="checkbox"
        aria-checked={item.done}
        onClick={onToggle}
        disabled={busy}
        className="flex min-w-0 flex-1 items-start gap-3 rounded-lg px-1 py-1.5 text-left hover:bg-white/[0.03] focus-visible:outline-2 focus-visible:outline-electric disabled:cursor-wait"
      >
        {mark}
        {text}
      </button>
      <button
        type="button"
        onClick={onRemove}
        disabled={busy}
        aria-label={`Apagar o item: ${item.body}`}
        className="grid size-8 shrink-0 place-items-center rounded-full text-mist opacity-100 hover:bg-alert/10 hover:text-alert sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
      >
        <X aria-hidden className="size-4" />
      </button>
    </li>
  );
}

/** Checklist: a desenvolvedora quebra o pedido em itens e marca; o Jota acompanha o andamento. */
function Checklist({ ticket, role, editable, onChanged }: DeliveryProps & { editable: boolean }) {
  const textareaId = useId();
  const toast = useToast();
  const [draft, setDraft] = useState("");
  const progress = checklistProgressOf(ticket);
  const add = useMutation((deps, text: string) => addSupportChecklistItems(deps, role, ticket.id, text));
  const toggle = useMutation(async (deps, item: SupportChecklistItem) => {
    await toggleSupportChecklistItem(deps, role, item.id, !item.done);
    return true;
  });
  const remove = useMutation(async (deps, item: SupportChecklistItem) => {
    await removeSupportChecklistItem(deps, role, item.id);
    return true;
  });
  const busy = add.pending || toggle.pending || remove.pending;

  const onAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const added = await add.run(draft);
    if (!added) return;
    setDraft("");
    toast.show(added === 1 ? "Item adicionado." : `${added} itens adicionados.`);
    onChanged();
  };

  const after = (ok: boolean | undefined) => {
    if (ok) onChanged();
  };

  return (
    <div className="space-y-3 border-t border-line pt-4">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm text-fog">
          <ListChecks aria-hidden className="size-4 text-mist" /> Checklist
        </span>
        {progress.total > 0 && (
          <span className={cn("text-sm font-semibold tabular-nums", progress.done === progress.total ? "text-emerald-300" : "text-white")}>
            {progress.done} de {progress.total} feitos
          </span>
        )}
      </div>
      {progress.total > 0 && <ProgressBar done={progress.done} total={progress.total} />}
      {ticket.checklist.length > 0 && (
        <ul className="space-y-0.5">
          {ticket.checklist.map((item) => (
            <ChecklistRow
              key={item.id}
              item={item}
              editable={editable}
              busy={busy}
              onToggle={() => void toggle.run(item).then(after)}
              onRemove={() => void remove.run(item).then(after)}
            />
          ))}
        </ul>
      )}
      {!editable && ticket.checklist.length === 0 && <p className="text-sm text-mist">Sem itens ainda.</p>}
      {editable && (
        <form onSubmit={(event) => void onAdd(event)} className="space-y-2">
          <label htmlFor={textareaId} className="sr-only">
            Itens da checklist, um por linha
          </label>
          <textarea
            id={textareaId}
            rows={2}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={"Um item por linha. Cole o pedido do Jota e separe cada coisa numa linha."}
            className="w-full resize-y rounded-xl border border-line-strong bg-ink px-3.5 py-2.5 text-sm text-white placeholder:text-mist/70 focus:border-electric focus:outline-none"
          />
          <Button type="submit" variant="secondary" disabled={busy || draft.trim().length === 0}>
            <Plus aria-hidden className="size-4" /> {add.pending ? "Adicionando…" : "Adicionar itens"}
          </Button>
        </form>
      )}
      {[add.error, toggle.error, remove.error].map((error) => error && <InlineError key={error.message} message={error.message} />)}
    </div>
  );
}

/**
 * Entrega do chamado: previsão, publicação e checklist. A desenvolvedora edita; o Jota acompanha.
 * Para o Jota o bloco só aparece quando tem alguma coisa para mostrar.
 */
export function DeliverySection({ ticket, role, onChanged }: DeliveryProps) {
  const editable = role === "developer";
  const hasContent = ticket.dueDate !== null || ticket.releasedAt !== null || ticket.checklist.length > 0;
  if (!editable && !hasContent) return null;
  return (
    <section aria-labelledby="entrega" className="space-y-4 rounded-3xl border border-line bg-surface/60 p-5">
      <div>
        <h2 id="entrega" className="font-display text-base font-semibold text-white">
          Entrega
        </h2>
        <p className="mt-0.5 text-xs text-mist">
          {editable
            ? "Quebre o pedido em itens, combine a previsão e marque quando estiver no ar. O Jota acompanha tudo daqui."
            : "O andamento do que você pediu: os itens, a previsão e quando já estiver no ar."}
        </p>
      </div>
      <DueDateRow ticket={ticket} role={role} onChanged={onChanged} editable={editable} />
      <ReleaseRow ticket={ticket} role={role} onChanged={onChanged} editable={editable} />
      <Checklist ticket={ticket} role={role} onChanged={onChanged} editable={editable} />
    </section>
  );
}
