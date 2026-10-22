import { Sparkles } from "lucide-react";
import { useCallback, useRef, useState, type KeyboardEvent } from "react";
import { MAX_PROOF_POINTS, PROOF_ICONS, type ProofIcon, type ProofPoint } from "@/domain/site-content";
import { TextField } from "@/ui/components/form/Fields";
import { cn } from "@/ui/lib/cn";
import { PROOF_ICON_VIEW, autoProofIcon } from "@/ui/lib/proof-icons";
import { useCloseOnOutsideClick } from "../lib/use-close-on-outside";
import { AddButton, type FieldErrors } from "./fields";
import { SortableList } from "./sortable";

const PATH = "hero.proofPoints";
const TEXT_MAX = 40;
const FIXED_ICONS = PROOF_ICONS.filter((icon): icon is Exclude<ProofIcon, "auto"> => icon !== "auto");

const optionClass =
  "grid place-items-center rounded-xl text-fog transition-colors hover:bg-white/[0.06] hover:text-white aria-pressed:bg-electric/15 aria-pressed:text-electric aria-pressed:ring-1 aria-pressed:ring-electric/50";

interface ProofIconPickerProps {
  point: ProofPoint;
  position: number;
  onChange: (icon: ProofIcon) => void;
}

/** Botão com o ícone atual; abre a grade de ícones. "Automático" escolhe pelo texto da prova. */
function ProofIconPicker({ point, position, onChange }: ProofIconPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useCloseOnOutsideClick(open, close, rootRef);

  const resolved = point.icon === "auto" ? autoProofIcon(point.text) : point.icon;
  const Current = PROOF_ICON_VIEW[resolved].icon;
  const currentLabel = point.icon === "auto" ? `Automático (${PROOF_ICON_VIEW[resolved].label})` : PROOF_ICON_VIEW[point.icon].label;

  const choose = (icon: ProofIcon) => {
    onChange(icon);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onPanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Ícone da prova ${position}: ${currentLabel}. Trocar ícone`}
        title="Trocar ícone"
        onClick={() => setOpen((value) => !value)}
        className="relative grid size-12 place-items-center rounded-xl border border-line-strong bg-ink text-electric transition-colors hover:border-electric"
      >
        <Current aria-hidden className="size-5" />
        {point.icon === "auto" && (
          <span aria-hidden className="absolute -right-1 -bottom-1 grid size-4 place-items-center rounded-full bg-electric text-ink">
            <Sparkles className="size-2.5" />
          </span>
        )}
      </button>
      {open && (
        <div
          role="group"
          aria-label={`Ícones para a prova ${position}`}
          onKeyDown={onPanelKeyDown}
          className="absolute top-full left-0 z-50 mt-2 w-[17.5rem] rounded-2xl border border-line-strong bg-night p-2 shadow-2xl shadow-black/70"
        >
          <button
            type="button"
            aria-pressed={point.icon === "auto"}
            autoFocus={point.icon === "auto"}
            onClick={() => choose("auto")}
            className={cn(optionClass, "mb-1 flex h-10 w-full justify-start gap-2 px-3 text-sm")}
          >
            <Sparkles aria-hidden className="size-4" />
            Automático, pelo texto
          </button>
          <div className="grid grid-cols-5 gap-1">
            {FIXED_ICONS.map((icon) => {
              const { icon: Icon, label } = PROOF_ICON_VIEW[icon];
              return (
                <button
                  key={icon}
                  type="button"
                  aria-pressed={point.icon === icon}
                  aria-label={label}
                  title={label}
                  autoFocus={point.icon === icon}
                  onClick={() => choose(icon)}
                  className={cn(optionClass, "size-12")}
                >
                  <Icon aria-hidden className="size-5" />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface ProofPointsFieldProps {
  points: ProofPoint[];
  onChange: (points: ProofPoint[]) => void;
  errors: FieldErrors;
}

/** Provas abaixo dos botões do topo: texto e ícone de cada uma, arrastar para reordenar, de 1 a 6. */
export function ProofPointsField({ points, onChange, errors }: ProofPointsFieldProps) {
  const update = (index: number, patch: Partial<ProofPoint>) =>
    onChange(points.map((point, position) => (position === index ? { ...point, ...patch } : point)));

  return (
    <fieldset className="space-y-2.5">
      <legend className="text-sm font-medium text-fog">Provas abaixo dos botões</legend>
      {errors[PATH] && <p className="text-xs font-medium text-[#ff7a7a]">{errors[PATH]}</p>}
      <SortableList
        items={points}
        onChange={onChange}
        min={1}
        itemLabel={(index) => `prova ${index + 1}`}
        className="space-y-2"
        itemClassName="flex items-start gap-1.5 rounded-xl bg-surface"
        renderItem={(point, index, { handle, remove }) => (
          <>
            {handle}
            <ProofIconPicker point={point} position={index + 1} onChange={(icon) => update(index, { icon })} />
            <TextField
              label={`Prova ${index + 1}`}
              name={`${PATH}.${index}.text`}
              className="min-w-0 flex-1 [&>label]:sr-only [&_input]:mt-0"
              value={point.text}
              maxLength={TEXT_MAX}
              onChange={(event) => update(index, { text: event.target.value })}
              error={errors[`${PATH}.${index}.text`]}
            />
            {remove}
          </>
        )}
      />
      <AddButton
        label="Adicionar prova"
        disabled={points.length >= MAX_PROOF_POINTS}
        onClick={() => onChange([...points, { text: "", icon: "auto" }])}
      />
      <p className="text-xs text-mist">
        Até {MAX_PROOF_POINTS}, com {TEXT_MAX} caracteres cada. Toque no ícone para trocar; no automático ele segue o texto.
      </p>
    </fieldset>
  );
}
