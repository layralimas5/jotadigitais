import { Laptop, Smartphone } from "lucide-react";
import { useId } from "react";
import { deviceKeyOf } from "@/domain/email-account";
import { cn } from "@/ui/lib/cn";

/** Os aparelhos que o Jota citou; entram como atalho mesmo antes de algum e-mail usar. */
const COMMON_DEVICES = ["iPhone", "PC", "POCO"];

/** Atalhos: os comuns mais os já usados em outros e-mails, sem repetir. */
export function deviceSuggestions(used: readonly string[]): string[] {
  const byKey = new Map<string, string>();
  for (const device of [...used, ...COMMON_DEVICES]) if (!byKey.has(deviceKeyOf(device))) byKey.set(deviceKeyOf(device), device);
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

const isComputer = (device: string) => /\b(pc|computador|notebook|mac|desktop|laptop)\b/i.test(device);

export function DeviceIcon({ device, className }: { device: string; className?: string }) {
  const Icon = isComputer(device) ? Laptop : Smartphone;
  return <Icon aria-hidden className={className} />;
}

interface DeviceFieldProps {
  value: string;
  onChange: (device: string) => void;
  /** Aparelhos já usados em outros e-mails. */
  used: readonly string[];
  error?: string;
  name?: string;
}

/** Em qual aparelho o e-mail está logado: toca num atalho ou escreve outro. */
export function DeviceField({ value, onChange, used, error, name = "device" }: DeviceFieldProps) {
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();
  const current = deviceKeyOf(value);
  const suggestions = deviceSuggestions(used);

  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="block text-sm font-medium text-fog">
        Aparelho onde está logado
      </label>
      <div role="group" aria-label="Atalhos de aparelho" className="flex flex-wrap gap-2">
        {suggestions.map((device) => {
          const selected = current !== "" && deviceKeyOf(device) === current;
          return (
            <button
              key={device}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(selected ? "" : device)}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric",
                selected ? "border-electric bg-electric/15 text-white" : "border-line-strong text-mist hover:border-white/25 hover:text-white",
              )}
            >
              <DeviceIcon device={device} className="size-3.5" />
              {device}
            </button>
          );
        })}
      </div>
      <input
        id={inputId}
        name={name}
        type="text"
        autoComplete="off"
        maxLength={40}
        placeholder="Ou escreva outro: Samsung da loja, notebook…"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        // "iphone" vira "iPhone": o mesmo aparelho fica com uma grafia só na lista e no filtro.
        onBlur={() => {
          const known = suggestions.find((device) => deviceKeyOf(device) === current);
          onChange(known ?? value.trim());
        }}
        aria-describedby={error ? errorId : hintId}
        aria-invalid={error ? true : undefined}
        className={cn(
          "h-12 w-full rounded-xl border bg-ink px-4 text-white placeholder:text-mist/70 transition-colors focus:outline-none",
          error ? "border-alert/70 focus:border-alert" : "border-line-strong focus:border-electric",
        )}
      />
      {error ? (
        <p id={errorId} className="text-xs font-medium text-[#ff7a7a]">
          {error}
        </p>
      ) : (
        <p id={hintId} className="text-xs text-mist">
          Onde chega o código quando a rede pede verificação. Aparece no filtro da aba E-mails.
        </p>
      )}
    </div>
  );
}
