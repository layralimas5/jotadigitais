import { Trash2 } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { MAX_DELIVERY_MESSAGE_NAME } from "@/domain/delivery-message";
import { MAX_TEMPLATE_LENGTH, MESSAGE_TEMPLATE_INFO, VARIABLE_LABEL } from "@/domain/message-template";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/form/Fields";
import { cn } from "@/ui/lib/cn";
import { useInsertAtCursor } from "../lib/use-insert-at-cursor";
import type { MessageOption } from "./use-delivery-messages";

const VARIABLES = MESSAGE_TEMPLATE_INFO.order_delivered.variables;

interface MessageEditorProps {
  /** Mensagem que está sendo editada: a padrão ou uma salva. */
  base: MessageOption;
  draft: string;
  onDraftChange: (draft: string) => void;
  canChangeDefault: boolean;
  pending: boolean;
  onSaveNew: (name: string) => void;
  onSaveChanges: () => void;
  onMakeDefault: () => void;
  onUseOnce: () => void;
  onDelete: () => void;
  onCancel: () => void;
}

/**
 * Texto da mensagem com as variáveis entre chaves. Salvar como nova guarda nas mensagens prontas; salvar como padrão
 * troca a que abre em todo pedido; usar só desta vez manda o texto editado sem guardar nada.
 */
export function MessageEditor(props: MessageEditorProps) {
  const { base, draft, onDraftChange, canChangeDefault, pending } = props;
  const id = useId();
  const { ref, insert } = useInsertAtCursor(draft, onDraftChange);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const empty = draft.trim() === "";
  const isDefault = base.choice === "default";
  const trimmedName = name.trim();

  const submitName = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (trimmedName) props.onSaveNew(trimmedName);
  };

  return (
    <div className="space-y-3 rounded-2xl border border-line-strong bg-ink/60 p-3 sm:p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-fog">
          Editando: <span className="text-white">{base.name}</span>
        </label>
        <span className="text-xs text-mist tabular-nums">
          {draft.length}/{MAX_TEMPLATE_LENGTH}
        </span>
      </div>
      <textarea
        ref={ref}
        id={id}
        rows={9}
        value={draft}
        maxLength={MAX_TEMPLATE_LENGTH}
        aria-describedby={`${id}-vars`}
        onChange={(event) => onDraftChange(event.target.value)}
        className="w-full rounded-xl border border-line-strong bg-ink px-4 py-3 font-mono text-[0.8rem] leading-relaxed text-white focus:border-electric focus:outline-none"
      />
      <div id={`${id}-vars`} className="flex flex-wrap items-center gap-1.5 text-xs text-mist">
        <span>Inserir:</span>
        {VARIABLES.map((variable) => (
          <button
            key={variable}
            type="button"
            title={VARIABLE_LABEL[variable]}
            onClick={() => insert(`{${variable}}`)}
            className="rounded-full border border-line-strong px-2.5 py-0.5 text-fog hover:border-electric hover:text-white"
          >
            {VARIABLE_LABEL[variable]}
          </button>
        ))}
      </div>
      <p className="text-xs text-mist">
        Use *asteriscos* para negrito. Linha com login que não está na ficha sai da mensagem sozinha.
      </p>

      {naming ? (
        <form onSubmit={submitName} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <TextField
            label="Nome da mensagem"
            name="deliveryMessageName"
            autoFocus
            autoComplete="off"
            maxLength={MAX_DELIVERY_MESSAGE_NAME}
            placeholder="Ex.: Instagram com e-mail"
            className="min-w-0 flex-1"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={pending || empty || !trimmedName} className="flex-1">
              {pending ? "Salvando…" : "Salvar"}
            </Button>
            <Button variant="ghost" onClick={() => setNaming(false)} disabled={pending}>
              Voltar
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-2 border-t border-line pt-3 sm:flex-row sm:flex-wrap">
          <Button onClick={props.onUseOnce} disabled={pending || empty}>
            Usar só neste envio
          </Button>
          <Button variant="secondary" onClick={() => setNaming(true)} disabled={pending || empty}>
            Salvar como nova
          </Button>
          {!isDefault && (
            <Button variant="secondary" onClick={props.onSaveChanges} disabled={pending || empty}>
              Salvar em “{base.name}”
            </Button>
          )}
          {canChangeDefault && (
            <Button variant="secondary" onClick={props.onMakeDefault} disabled={pending || empty}>
              Salvar como padrão
            </Button>
          )}
          <Button variant="ghost" onClick={props.onCancel} disabled={pending} className="sm:ml-auto">
            Cancelar
          </Button>
        </div>
      )}

      {!isDefault && !naming && (
        <div className={cn("flex flex-wrap items-center gap-2 text-xs", confirmDelete ? "text-[#ff9a9a]" : "text-mist")}>
          {confirmDelete ? (
            <>
              <span>Apagar “{base.name}” das mensagens prontas?</span>
              <button type="button" onClick={props.onDelete} disabled={pending} className="font-semibold text-[#ff7a7a] hover:underline">
                Apagar
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="text-fog hover:underline">
                Não
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1 hover:text-[#ff9a9a]">
              <Trash2 aria-hidden className="size-3.5" /> Apagar esta mensagem
            </button>
          )}
        </div>
      )}
    </div>
  );
}
