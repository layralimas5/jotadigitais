import { ArrowDown, ArrowUp, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { MAX_ACCOUNT_SPECS, type Account, type AccountSpec } from "@/domain/account";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/form/Fields";
import { useSiteContent } from "@/ui/hooks/useSiteContent";
import { automaticSpecsOf } from "@/ui/lib/account-presenter";
import { AccountSpecs } from "@/ui/sections/account/AccountDetails";
import type { AccountFormErrors } from "../forms/account-form";

interface AccountSpecsFieldProps {
  /** Ficha escrita para a conta; nula = automática. */
  specs: AccountSpec[] | null;
  /** A conta como fica com o que já foi preenchido; nula enquanto faltam dados. */
  preview: Account | null;
  errors: AccountFormErrors;
  onChange: (specs: AccountSpec[] | null) => void;
}

const iconButton =
  "grid size-9 shrink-0 place-items-center rounded-lg border border-line text-mist transition-colors hover:border-white/25 hover:text-white focus-visible:outline-2 focus-visible:outline-electric disabled:pointer-events-none disabled:opacity-30";

function move<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

interface SpecRowProps {
  spec: AccountSpec;
  index: number;
  total: number;
  errors: AccountFormErrors;
  onUpdate: (spec: AccountSpec) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
}

function SpecRow({ spec, index, total, errors, onUpdate, onMove, onRemove }: SpecRowProps) {
  const position = `linha ${index + 1}`;
  return (
    <li className="rounded-2xl border border-line bg-ink/40 p-3 sm:p-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <TextField
          label="Nome"
          name={`specs.${index}.label`}
          maxLength={40}
          placeholder="Ex.: Seguidores"
          value={spec.label}
          onChange={(event) => onUpdate({ ...spec, label: event.target.value })}
          error={errors[`specs.${index}.label`]}
        />
        <TextField
          label="Valor"
          name={`specs.${index}.value`}
          maxLength={120}
          placeholder="Ex.: 1.259"
          value={spec.value}
          onChange={(event) => onUpdate({ ...spec, value: event.target.value })}
          error={errors[`specs.${index}.value`]}
        />
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" className={iconButton} disabled={index === 0} onClick={() => onMove(index - 1)} aria-label={`Subir ${position}`}>
          <ArrowUp aria-hidden className="size-4" />
        </button>
        <button type="button" className={iconButton} disabled={index === total - 1} onClick={() => onMove(index + 1)} aria-label={`Descer ${position}`}>
          <ArrowDown aria-hidden className="size-4" />
        </button>
        <button
          type="button"
          className={`${iconButton} hover:border-alert/50 hover:text-alert`}
          disabled={total === 1}
          onClick={onRemove}
          aria-label={`Apagar ${position}`}
        >
          <Trash2 aria-hidden className="size-4" />
        </button>
      </div>
    </li>
  );
}

/**
 * Ficha técnica da página da conta. Sem edição ela é automática (acompanha rede, números e as linhas fixas da aba Site);
 * em "Editar ficha técnica" vira linhas que o Jota escreve, e vale o que ele escreveu até voltar à automática.
 */
export function AccountSpecsField({ specs, preview, errors, onChange }: AccountSpecsFieldProps) {
  const { accountPage } = useSiteContent();

  if (specs === null) {
    return (
      <div className="rounded-2xl border border-line bg-ink/40 p-4">
        {preview ? (
          <div className="pointer-events-none">
            <AccountSpecs account={preview} />
          </div>
        ) : (
          <p className="text-sm text-mist">Preencha os dados da conta para ver a ficha técnica.</p>
        )}
        <p className="mt-4 text-xs leading-relaxed text-mist">
          Ficha automática: acompanha a rede, o país, o nicho e os números desta conta. Para escrever do seu jeito, edite aqui.
        </p>
        <Button
          variant="secondary"
          className="mt-3"
          disabled={!preview}
          onClick={() => preview && onChange(automaticSpecsOf(preview, accountPage.fixedSpecs))}
        >
          <Pencil aria-hidden className="size-4" /> Editar ficha técnica
        </Button>
      </div>
    );
  }

  const update = (index: number, spec: AccountSpec) => onChange(specs.map((item, at) => (at === index ? spec : item)));
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-fog">Ficha técnica desta conta</legend>
      <p className="text-xs leading-relaxed text-mist">
        Escrita por você: é exatamente o que aparece na página da conta. Os números aqui não mudam sozinhos quando você troca seguidores ou
        curtidas acima.
      </p>
      <ol className="space-y-3">
        {specs.map((spec, index) => (
          <SpecRow
            key={index}
            spec={spec}
            index={index}
            total={specs.length}
            errors={errors}
            onUpdate={(next) => update(index, next)}
            onMove={(to) => onChange(move(specs, index, to))}
            onRemove={() => onChange(specs.filter((_, at) => at !== index))}
          />
        ))}
      </ol>
      {errors.specs && (
        <p role="alert" className="text-xs font-medium text-[#ff7a7a]">
          {errors.specs}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={specs.length >= MAX_ACCOUNT_SPECS} onClick={() => onChange([...specs, { label: "", value: "" }])}>
          <Plus aria-hidden className="size-4" /> Adicionar linha
        </Button>
        <Button variant="ghost" onClick={() => onChange(null)}>
          <RotateCcw aria-hidden className="size-4" /> Voltar à ficha automática
        </Button>
      </div>
    </fieldset>
  );
}
