import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import type { SiteImage } from "@/domain/site-content";
import { TextField } from "@/ui/components/form/Fields";
import { TextAreaField } from "../components/FormControls";
import { SingleImageField } from "../components/ImageUpload";
import { SortableList } from "./sortable";

/** Erros do rascunho por caminho completo ("hero.title"). */
export type FieldErrors = Record<string, string>;

const counter = (value: string, max: number) => `${value.length}/${max}`;

interface CopyFieldProps {
  label: string;
  path: string;
  value: string;
  onChange: (value: string) => void;
  errors: FieldErrors;
  max: number;
  multiline?: boolean;
  hint?: string;
}

/** Campo de texto do site com contador de caracteres e o erro do seu caminho. */
export function CopyField({ label, path, value, onChange, errors, max, multiline = false, hint }: CopyFieldProps) {
  const fullHint = [hint, counter(value, max)].filter(Boolean).join(" · ");
  const props = { label, name: path, value, error: errors[path], hint: fullHint, maxLength: max };
  return multiline ? (
    <TextAreaField {...props} rows={3} onChange={(event) => onChange(event.target.value)} />
  ) : (
    <TextField {...props} onChange={(event) => onChange(event.target.value)} />
  );
}

function AddButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-full border border-dashed border-line-strong px-4 py-2 text-sm text-fog transition-colors hover:border-electric hover:text-white disabled:pointer-events-none disabled:opacity-40"
    >
      <Plus aria-hidden className="size-4" /> {label}
    </button>
  );
}

interface CopyListFieldProps {
  label: string;
  path: string;
  items: string[];
  onChange: (items: string[]) => void;
  errors: FieldErrors;
  itemMax: number;
  min: number;
  max: number;
  addLabel: string;
}

/** Lista de frases curtas (ex.: itens de um checklist): editar, reordenar, tirar e pôr. */
export function CopyListField({ label, path, items, onChange, errors, itemMax, min, max, addLabel }: CopyListFieldProps) {
  const update = (index: number, value: string) => onChange(items.map((item, current) => (current === index ? value : item)));
  return (
    <fieldset className="space-y-2.5">
      <legend className="text-sm font-medium text-fog">{label}</legend>
      {errors[path] && <p className="text-xs font-medium text-[#ff7a7a]">{errors[path]}</p>}
      <SortableList
        items={items}
        onChange={onChange}
        min={min}
        itemLabel={(index) => `item ${index + 1}`}
        className="space-y-2"
        itemClassName="flex items-start gap-1 rounded-xl bg-surface"
        renderItem={(item, index, { handle, remove }) => (
          <>
            {handle}
            <TextField
              label={`${label}, item ${index + 1}`}
              name={`${path}.${index}`}
              className="min-w-0 flex-1 [&>label]:sr-only [&_input]:mt-0"
              value={item}
              maxLength={itemMax}
              onChange={(event) => update(index, event.target.value)}
              error={errors[`${path}.${index}`]}
            />
            {remove}
          </>
        )}
      />
      <AddButton label={addLabel} disabled={items.length >= max} onClick={() => onChange([...items, ""])} />
    </fieldset>
  );
}

interface RepeaterProps<T> {
  legend: string;
  path: string;
  items: T[];
  onChange: (items: T[]) => void;
  errors: FieldErrors;
  min: number;
  max: number;
  addLabel: string;
  itemLabel: (index: number) => string;
  empty: () => T;
  render: (item: T, update: (patch: Partial<T>) => void, itemPath: string) => ReactNode;
}

/** Lista de blocos com vários campos (perguntas, seções dos termos), cada um num cartão. */
export function Repeater<T>({ legend, path, items, onChange, errors, min, max, addLabel, itemLabel, empty, render }: RepeaterProps<T>) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-fog">{legend}</legend>
      {errors[path] && <p className="text-xs font-medium text-[#ff7a7a]">{errors[path]}</p>}
      <SortableList
        items={items}
        onChange={onChange}
        min={min}
        itemLabel={(index) => itemLabel(index).toLowerCase()}
        className="space-y-3"
        itemClassName="rounded-2xl border border-line-strong bg-ink p-3.5"
        renderItem={(item, index, { handle, remove }) => {
          const update = (patch: Partial<T>) =>
            onChange(items.map((current, position) => (position === index ? { ...current, ...patch } : current)));
          return (
            <>
              <div className="mb-2 flex items-center gap-1">
                {handle}
                <p className="flex-1 text-xs font-semibold text-mist">{itemLabel(index)}</p>
                {remove}
              </div>
              <div className="space-y-3">{render(item, update, `${path}.${index}`)}</div>
            </>
          );
        }}
      />
      <AddButton label={addLabel} disabled={items.length >= max} onClick={() => onChange([...items, empty()])} />
    </fieldset>
  );
}

interface ImageCopyFieldProps {
  label: string;
  path: string;
  image: SiteImage;
  onChange: (image: SiteImage) => void;
  errors: FieldErrors;
}

/** Imagem do site: troca pelo envio (vai para a pasta "site") e descrição para leitor de tela. */
export function ImageCopyField({ label, path, image, onChange, errors }: ImageCopyFieldProps) {
  return (
    <div className="space-y-3">
      <SingleImageField
        label={label}
        name={`${path}.url`}
        folder="site"
        value={image.url}
        alt={image.alt}
        error={errors[`${path}.url`]}
        onUploaded={(uploaded) => onChange({ ...image, url: uploaded.url })}
      />
      <CopyField
        label="Descrição da imagem"
        hint="Para quem usa leitor de tela e para o Google."
        path={`${path}.alt`}
        value={image.alt}
        max={240}
        multiline
        errors={errors}
        onChange={(alt) => onChange({ ...image, alt })}
      />
    </div>
  );
}
