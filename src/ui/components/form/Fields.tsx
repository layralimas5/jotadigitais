import { ChevronDown } from "lucide-react";
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { cn } from "@/ui/lib/cn";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, className, ...props },
  ref,
) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="text-sm font-medium text-fog">
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "mt-2 h-12 w-full rounded-xl border bg-ink px-4 text-white placeholder:text-mist/70 transition-colors focus:outline-none",
          error ? "border-alert/70 focus:border-alert" : "border-line-strong focus:border-electric",
        )}
        {...props}
      />
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-mist">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-[#ff7a7a]">
          {error}
        </p>
      )}
    </div>
  );
});

interface ChoiceCardProps {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  title: string;
  description: string;
  icon: ReactNode;
}

export function ChoiceCard({ name, value, checked, onChange, title, description, icon }: ChoiceCardProps) {
  return (
    <label
      className={cn(
        "relative flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-electric",
        checked ? "border-electric bg-electric/[0.08]" : "border-line-strong hover:border-white/25",
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="sr-only"
      />
      <span className={cn("mt-0.5", checked ? "text-electric" : "text-mist")}>{icon}</span>
      <span className="flex-1">
        <span className="block text-sm font-semibold text-white">{title}</span>
        <span className="mt-0.5 block text-xs text-mist">{description}</span>
      </span>
      <span
        aria-hidden
        className={cn(
          "mt-0.5 grid size-5 place-items-center rounded-full border-2 transition-colors",
          checked ? "border-electric" : "border-line-strong",
        )}
      >
        {checked && <span className="size-2.5 rounded-full bg-electric" />}
      </span>
    </label>
  );
}

interface SelectInputProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: string;
  error?: string;
  options: readonly { value: string; label: string }[];
}

/** Lista de escolha no mesmo visual do TextField. */
export const SelectInput = forwardRef<HTMLSelectElement, SelectInputProps>(function SelectInput(
  { label, hint, error, options, className, ...props },
  ref,
) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="text-sm font-medium text-fog">
        {label}
      </label>
      <div className="relative mt-2">
        <select
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "h-12 w-full cursor-pointer appearance-none rounded-xl border bg-ink pr-11 pl-4 text-white transition-colors [color-scheme:dark] focus:outline-none",
            error ? "border-alert/70 focus:border-alert" : "border-line-strong focus:border-electric",
          )}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} className="bg-surface-2 text-white">
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-mist" />
      </div>
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-mist">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-[#ff7a7a]">
          {error}
        </p>
      )}
    </div>
  );
});
