import { useId, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/ui/lib/cn";

const controlClass = (error?: string) =>
  cn(
    "mt-2 w-full rounded-xl border bg-ink px-4 text-white placeholder:text-mist/70 transition-colors focus:outline-none",
    error ? "border-alert/70 focus:border-alert" : "border-line-strong focus:border-electric",
  );

function FieldMessages({ id, hint, error }: { id: string; hint?: string; error?: string }) {
  if (error) {
    return (
      <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-[#ff7a7a]">
        {error}
      </p>
    );
  }
  if (hint) {
    return (
      <p id={`${id}-hint`} className="mt-1.5 text-xs text-mist">
        {hint}
      </p>
    );
  }
  return null;
}

function describedBy(id: string, hint?: string, error?: string) {
  if (error) return `${id}-error`;
  return hint ? `${id}-hint` : undefined;
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: string;
  error?: string;
  options: readonly { value: string; label: string }[];
}

export function SelectField({ label, hint, error, options, className, ...props }: SelectFieldProps) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="text-sm font-medium text-fog">
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(controlClass(error), "h-12")}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldMessages id={id} hint={hint} error={error} />
    </div>
  );
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string;
}

export function TextAreaField({ label, hint, error, className, ...props }: TextAreaFieldProps) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="text-sm font-medium text-fog">
        {label}
      </label>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(controlClass(error), "min-h-28 py-3 leading-relaxed")}
        {...props}
      />
      <FieldMessages id={id} hint={hint} error={error} />
    </div>
  );
}

interface ToggleFieldProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  name?: string;
}

/** Interruptor acessível: é um checkbox de verdade com `role="switch"`. */
export function ToggleField({ label, description, checked, onChange, name }: ToggleFieldProps) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-line-strong bg-ink px-4 py-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-electric"
    >
      <span>
        <span className="block text-sm font-medium text-white">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-mist">{description}</span>}
      </span>
      <input
        id={id}
        name={name}
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      <span
        aria-hidden
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-electric" : "bg-line-strong",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform",
            checked && "translate-x-5",
          )}
        />
      </span>
    </label>
  );
}

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

interface SegmentedFieldProps<T extends string> {
  legend: string;
  name: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  columns?: 2 | 4;
}

/** Grupo de rádios com cara de botões, para escolhas curtas (rede social, tipo de depoimento). */
export function SegmentedField<T extends string>({ legend, name, value, options, onChange, columns = 2 }: SegmentedFieldProps<T>) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-fog">{legend}</legend>
      <div className={cn("mt-2 grid gap-2", columns === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2")}>
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-electric",
              value === option.value
                ? "border-electric bg-electric/10 text-white"
                : "border-line-strong text-mist hover:border-white/25 hover:text-white",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.icon}
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
