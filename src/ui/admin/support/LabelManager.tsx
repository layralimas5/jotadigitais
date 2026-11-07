import { Check, Pencil, Plus, Tags, Trash2, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { fieldErrorsOf, supportLabelSchema } from "@/application/schemas";
import { deleteSupportLabel, saveSupportLabel } from "@/application/support-use-cases";
import type { AdminRole } from "@/domain/admin-user";
import {
  SUPPORT_LABEL_COLOR_NAME,
  SUPPORT_LABEL_COLORS,
  SUPPORT_LABEL_NAME_MAX,
  type SupportLabel,
  type SupportLabelColor,
  type SupportLabelData,
} from "@/domain/support-ticket";
import { Button } from "@/ui/components/Button";
import { cn } from "@/ui/lib/cn";
import { InlineError } from "../components/AdminUi";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useMutation } from "../hooks";
import { useToast } from "../toast";
import { LABEL_TONE } from "./label-tone";
import { SupportLabelBadge } from "./SupportBadges";

const EMPTY: SupportLabelData = { name: "", color: "electric" };
const SUGGESTIONS = ["Em andamento agora", "Falta", "Finalizado", "Falta testar", "Esperando aprovação"];

function ColorChoice({ value, onChange, name }: { value: SupportLabelColor; onChange: (color: SupportLabelColor) => void; name: string }) {
  return (
    <fieldset>
      <legend className="sr-only">Cor</legend>
      <div className="flex flex-wrap gap-2">
        {SUPPORT_LABEL_COLORS.map((color) => (
          <label
            key={color}
            title={SUPPORT_LABEL_COLOR_NAME[color]}
            className={cn(
              "grid size-8 cursor-pointer place-items-center rounded-full border-2 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-electric",
              value === color ? "border-white" : "border-transparent hover:border-white/30",
            )}
          >
            <input type="radio" name={name} value={color} checked={value === color} onChange={() => onChange(color)} className="sr-only" />
            <span className="sr-only">{SUPPORT_LABEL_COLOR_NAME[color]}</span>
            <span aria-hidden className={cn("size-5 rounded-full", LABEL_TONE[color].dot)} />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

interface LabelFormProps {
  initial: SupportLabelData;
  submitLabel: string;
  pending: boolean;
  error: string | null;
  onSubmit: (data: SupportLabelData) => void;
  onCancel?: () => void;
}

function LabelForm({ initial, submitLabel, pending, error, onSubmit, onCancel }: LabelFormProps) {
  const id = useId();
  const [values, setValues] = useState(initial);
  const [nameError, setNameError] = useState<string | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = supportLabelSchema.safeParse(values);
    if (!result.success) {
      setNameError(fieldErrorsOf(result.error).name ?? "Confira o nome.");
      return;
    }
    setNameError(null);
    onSubmit(result.data);
  };

  const shownError = nameError ?? error;
  return (
    <form noValidate onSubmit={submit} className="space-y-3">
      <div>
        <label htmlFor={`${id}-name`} className="text-sm font-medium text-fog">
          Nome
        </label>
        <input
          id={`${id}-name`}
          name="name"
          autoComplete="off"
          maxLength={SUPPORT_LABEL_NAME_MAX}
          value={values.name}
          onChange={(event) => setValues({ ...values, name: event.target.value })}
          placeholder="Ex.: Falta testar"
          aria-invalid={shownError ? true : undefined}
          aria-describedby={shownError ? `${id}-error` : undefined}
          className="mt-2 h-11 w-full rounded-xl border border-line-strong bg-ink px-4 text-white placeholder:text-mist/70 focus:border-electric focus:outline-none"
        />
        {shownError && (
          <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-[#ff7a7a]">
            {shownError}
          </p>
        )}
      </div>
      <ColorChoice name={`${id}-color`} value={values.color} onChange={(color) => setValues({ ...values, color })} />
      <div className="flex items-center justify-between gap-3">
        <SupportLabelBadge label={{ id: "preview", name: values.name.trim() || "Prévia", color: values.color }} />
        <div className="flex gap-2">
          {onCancel && (
            <Button variant="ghost" onClick={onCancel} disabled={pending}>
              <X aria-hidden className="size-4" /> Cancelar
            </Button>
          )}
          <Button type="submit" disabled={pending}>
            {onCancel ? <Check aria-hidden className="size-4" /> : <Plus aria-hidden className="size-4" />} {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}

interface LabelManagerProps {
  labels: readonly SupportLabel[];
  role: AdminRole;
  onChanged: () => void;
}

/** Botão "Etiquetas" e a janela onde a desenvolvedora cria, renomeia, troca a cor e apaga etiquetas. */
export function LabelManager({ labels, role, onChanged }: LabelManagerProps) {
  const toast = useToast();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [toDelete, setToDelete] = useState<SupportLabel | null>(null);
  const save = useMutation((deps, id: string | null, data: SupportLabelData) => saveSupportLabel(deps, role, id, data));
  const remove = useMutation((deps, id: string) => deleteSupportLabel(deps, role, id).then(() => true));

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const onSave = async (id: string | null, data: SupportLabelData) => {
    const saved = await save.run(id, data);
    if (!saved) return;
    toast.show(id ? "Etiqueta atualizada." : `Etiqueta “${saved.name}” criada.`);
    setEditingId(null);
    setFormKey((key) => key + 1);
    onChanged();
  };

  const onRemove = async (label: SupportLabel) => {
    const done = await remove.run(label.id);
    setToDelete(null);
    if (!done) return;
    toast.show("Etiqueta apagada.");
    onChanged();
  };

  const unusedSuggestions = SUGGESTIONS.filter((name) => !labels.some((label) => label.name.toLowerCase() === name.toLowerCase()));

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Tags aria-hidden className="size-4" /> Etiquetas
      </Button>
      <dialog
        ref={dialogRef}
        onClose={() => {
          setOpen(false);
          setEditingId(null);
          save.reset();
        }}
        aria-labelledby="etiquetas-titulo"
        className="m-auto max-h-[90dvh] w-[min(32rem,calc(100vw-2rem))] overflow-y-auto rounded-3xl border border-line-strong bg-surface p-6 text-white backdrop:bg-black/70 backdrop:backdrop-blur-sm max-sm:mb-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="etiquetas-titulo" className="font-display text-lg font-semibold">
              Etiquetas do suporte
            </h2>
            <p className="mt-1 text-sm text-mist">Crie as suas e escolha uma em cada chamado. O Jota vê, mas não muda.</p>
            <p className="mt-1 text-xs text-mist">
              A etiqueta é só uma marcação. Quem tira o chamado de “Em aberto” é a <strong className="text-fog">Situação</strong> (Finalizado).
            </p>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="rounded-full p-1.5 text-mist hover:bg-white/[0.06] hover:text-white">
            <X aria-hidden className="size-5" />
          </button>
        </div>

        <section aria-label="Nova etiqueta" className="mt-5 rounded-2xl border border-line bg-ink/60 p-4">
          <LabelForm
            key={formKey}
            initial={EMPTY}
            submitLabel="Criar"
            pending={save.pending && editingId === null}
            error={editingId === null ? (save.error?.message ?? null) : null}
            onSubmit={(data) => void onSave(null, data)}
          />
          {unusedSuggestions.length > 0 && (
            <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-mist">
              Ideias:
              {unusedSuggestions.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => void onSave(null, { name, color: "electric" })}
                  className="rounded-full border border-line-strong px-2.5 py-1 text-fog hover:border-white/30 hover:text-white"
                >
                  + {name}
                </button>
              ))}
            </p>
          )}
        </section>

        {remove.error && (
          <div className="mt-4">
            <InlineError message={remove.error.message} />
          </div>
        )}

        <ul aria-label="Etiquetas criadas" className="mt-5 divide-y divide-line">
          {labels.length === 0 && <li className="py-3 text-sm text-mist">Nenhuma etiqueta ainda.</li>}
          {labels.map((label) => (
            <li key={label.id} className="py-3">
              {editingId === label.id ? (
                <LabelForm
                  initial={{ name: label.name, color: label.color }}
                  submitLabel="Salvar"
                  pending={save.pending}
                  error={save.error?.message ?? null}
                  onSubmit={(data) => void onSave(label.id, data)}
                  onCancel={() => {
                    setEditingId(null);
                    save.reset();
                  }}
                />
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <SupportLabelBadge label={label} />
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        save.reset();
                        setEditingId(label.id);
                      }}
                      aria-label={`Editar ${label.name}`}
                      className="rounded-full p-2 text-mist hover:bg-white/[0.06] hover:text-white"
                    >
                      <Pencil aria-hidden className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setToDelete(label)}
                      disabled={remove.pending}
                      aria-label={`Apagar ${label.name}`}
                      className="rounded-full p-2 text-mist hover:bg-alert/15 hover:text-[#ff8a8a]"
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
        <ConfirmDialog
          open={toDelete !== null}
          title={`Apagar “${toDelete?.name ?? ""}”?`}
          description="Os chamados com essa etiqueta ficam sem etiqueta. A situação deles não muda."
          confirmLabel="Apagar etiqueta"
          pending={remove.pending}
          onConfirm={() => toDelete && void onRemove(toDelete)}
          onClose={() => setToDelete(null)}
        />
      </dialog>
    </>
  );
}
