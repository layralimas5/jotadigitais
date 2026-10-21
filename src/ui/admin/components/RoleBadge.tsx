import { ADMIN_ROLE_LABEL, type AdminRole } from "@/domain/admin-user";
import { cn } from "@/ui/lib/cn";

const TONE: Record<AdminRole, string> = {
  admin: "border-amber-300/40 bg-amber-300/10 text-amber-200",
  developer: "border-pink/40 bg-pink/10 text-pink",
};

export function RoleBadge({ role, className }: { role: AdminRole; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[0.68rem] font-semibold", TONE[role], className)}>
      {ADMIN_ROLE_LABEL[role]}
    </span>
  );
}
