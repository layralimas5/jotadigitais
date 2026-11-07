import { Bell } from "lucide-react";

interface NotifyAdminCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

/** Opção da Layra de mandar o aviso para o sininho do Jota. */
export function NotifyAdminCheckbox({ checked, onChange, disabled }: NotifyAdminCheckboxProps) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-fog">
      <input
        type="checkbox"
        name="notifyAdmin"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-[var(--color-electric)]"
      />
      <Bell aria-hidden className="size-3.5 text-mist" />
      Avisar o Jota no sininho
    </label>
  );
}
