import { Eye, EyeOff, Sparkles } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/ui/lib/cn";
import { CopyButton } from "./CopyButton";
import { generatePassword } from "./generate-password";
import { useCopy } from "./use-copy";

interface SecretFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
}

const iconButton =
  "grid size-9 shrink-0 place-items-center rounded-full text-mist transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-2 focus-visible:outline-electric";

/** Senha oculta por padrão, com mostrar, copiar e gerar uma senha forte. */
export function SecretField({ label, name, value, onChange, error, hint }: SecretFieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const copy = useCopy();
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;

  const generate = () => {
    onChange(generatePassword());
    setVisible(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-fog">
          {label}
        </label>
        <button type="button" onClick={generate} className="inline-flex items-center gap-1.5 text-xs font-medium text-electric-soft hover:underline">
          <Sparkles aria-hidden className="size-3.5" /> Gerar senha forte
        </button>
      </div>
      <div
        className={cn(
          "mt-2 flex h-12 items-center rounded-xl border bg-ink pr-1.5 transition-colors focus-within:border-electric",
          error ? "border-alert/70 focus-within:border-alert" : "border-line-strong",
        )}
      >
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={200}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          // Evita que o gerenciador de senhas do navegador ofereça salvar a senha da conta como se fosse do painel.
          data-1p-ignore
          data-lpignore="true"
          className="h-full min-w-0 flex-1 bg-transparent px-4 font-mono text-white placeholder:font-sans placeholder:text-mist/70 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visible}
          title={visible ? "Ocultar senha" : "Mostrar senha"}
          className={iconButton}
        >
          {visible ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
        </button>
        {value && <CopyButton label="Copiar senha" onCopy={() => void copy(value, "Senha copiada.")} />}
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
}
