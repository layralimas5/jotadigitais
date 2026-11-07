import { ShieldCheck, ShieldOff } from "lucide-react";
import type { ReactNode } from "react";
import type { AccessUser } from "@/domain/access-user";
import { cn } from "@/ui/lib/cn";
import { formatDate, formatRelative } from "../lib/dates";

export const accessPath = (userId: string) => `/admin/acessos/${userId}`;

export const displayName = (user: Pick<AccessUser, "name" | "email">) => user.name ?? user.email;

function Pill({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.68rem] font-semibold",
        ok ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-white/15 bg-white/[0.05] text-mist",
      )}
    >
      {children}
    </span>
  );
}

/** Último acesso, sessões, duas etapas e desde quando: o estado do acesso numa olhada. */
export function AccessFacts({ user }: { user: AccessUser }) {
  return (
    <dl className="grid grid-cols-2 gap-3 rounded-2xl border border-line bg-ink/50 p-3 text-xs sm:grid-cols-4">
      <div>
        <dt className="text-mist">Último acesso</dt>
        <dd className="mt-0.5 font-medium text-white" title={user.lastSignInAt ? formatDate(user.lastSignInAt) : undefined}>
          {user.lastSignInAt ? formatRelative(user.lastSignInAt) : "Nunca entrou"}
        </dd>
      </div>
      <div>
        <dt className="text-mist">Sessões ativas</dt>
        <dd className="mt-0.5 font-medium text-white tabular-nums">{user.activeSessions}</dd>
      </div>
      <div>
        <dt className="text-mist">Duas etapas</dt>
        <dd className="mt-1">
          <Pill ok={user.mfaEnabled}>
            {user.mfaEnabled ? <ShieldCheck aria-hidden className="size-3" /> : <ShieldOff aria-hidden className="size-3" />}
            {user.mfaEnabled ? "Ligada" : "Desligada"}
          </Pill>
        </dd>
      </div>
      <div>
        <dt className="text-mist">Desde</dt>
        <dd className="mt-0.5 font-medium text-white">{formatDate(user.createdAt)}</dd>
      </div>
    </dl>
  );
}
