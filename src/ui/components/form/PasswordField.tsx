import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useId, useState, type InputHTMLAttributes } from "react";
import { cn } from "@/ui/lib/cn";

interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  hint?: string;
  error?: string;
  /** Começa mostrando a senha (ex.: senha provisória que a TI acabou de gerar). */
  initiallyVisible?: boolean;
}

/** Campo de senha com o olhinho para ver o que está sendo digitado. Mesmo visual do TextField. */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField(
  { label, hint, error, className, initiallyVisible = false, ...props },
  ref,
) {
  const id = useId();
  const [visible, setVisible] = useState(initiallyVisible);
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="text-sm font-medium text-fog">
        {label}
      </label>
      <div className="relative mt-2">
        <input
          ref={ref}
          id={id}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          className={cn(
            "h-12 w-full rounded-xl border bg-ink pr-12 pl-4 text-white placeholder:text-mist/70 transition-colors focus:outline-none",
            error ? "border-alert/70 focus:border-alert" : "border-line-strong focus:border-electric",
          )}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? "Esconder senha" : "Mostrar senha"}
          aria-pressed={visible}
          aria-controls={id}
          className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-mist transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-2 focus-visible:outline-electric"
        >
          {visible ? <EyeOff aria-hidden className="size-[1.1rem]" /> : <Eye aria-hidden className="size-[1.1rem]" />}
        </button>
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
