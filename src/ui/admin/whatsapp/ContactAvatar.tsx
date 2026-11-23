import { cn } from "@/ui/lib/cn";

/** "Bruna Alves" → "BA"; sem nome, os dois últimos dígitos do número. */
export function contactInitials(name: string | null, phone: string): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return phone.slice(-2);
  const first = words[0]!.charAt(0);
  const last = words.length > 1 ? words[words.length - 1]!.charAt(0) : "";
  return (first + last).toUpperCase();
}

export function ContactAvatar({ name, phone, className }: { name: string | null; phone: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold text-fog ring-1 ring-inset ring-line-strong tabular-nums",
        className,
      )}
    >
      {contactInitials(name, phone)}
    </span>
  );
}
