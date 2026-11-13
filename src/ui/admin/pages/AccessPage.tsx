import { ChevronRight, Eye, UserPlus } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { container } from "@/app/container";
import { listAccessUsers } from "@/application/access-use-cases";
import { listAdminUsers } from "@/application/admin-use-cases";
import type { AccessUser } from "@/domain/access-user";
import { sameEmail, type AdminRole, type StaffPermission } from "@/domain/admin-user";
import { Button, ButtonLink } from "@/ui/components/Button";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { LoadingBlock, PageHeader } from "../components/AdminUi";
import { PersonAvatar } from "../components/PersonAvatar";
import { RoleBadge } from "../components/RoleBadge";
import { useAdminQuery } from "../hooks";
import { formatPhone } from "../lib/whatsapp";
import { AccessFacts, accessPath, displayName } from "../access/AccessParts";
import { SendAccessDialog, type AccessToSend } from "../access/SendAccessDialog";
import { NEW_ACCESS_PATH } from "../navigation";
import { usePreviewToggle } from "../preview/PreviewControls";
import type { ViewSubject } from "../admin-view";
import { useAdminSession } from "../session";

const IS_DEMO = container.mode === "demo";

/** Usuário recém-criado que a ficha de novo usuário manda para cá, para já mandar o acesso. */
function createdAccessOf(state: unknown): AccessToSend | null {
  if (typeof state !== "object" || state === null || !("createdAccess" in state)) return null;
  const value = (state as { createdAccess: unknown }).createdAccess;
  if (typeof value !== "object" || value === null) return null;
  const { name, email, password } = value as Record<string, unknown>;
  if (typeof email !== "string" || typeof password !== "string") return null;
  return { name: typeof name === "string" ? name : null, email, password, whatsapp: null };
}

/** Áreas liberadas de cada ajudante, pelo id: a lista de acessos não traz as permissões. */
type PermissionsById = ReadonlyMap<string, readonly StaffPermission[]>;

/** Com quem dá para "ver como": o Jota e os ajudantes (a desenvolvedora já vê o próprio painel). */
function subjectOf(user: AccessUser, permissionsById: PermissionsById | null): ViewSubject | null {
  if (user.role === "developer") return null;
  if (user.role === "admin") return { name: displayName(user), access: { role: "admin", permissions: [] } };
  const permissions = permissionsById?.get(user.id);
  return permissions ? { name: displayName(user), access: { role: "helper", permissions } } : null;
}

/** Cartão inteiro clicável: abre a ficha do usuário. "Ver como" fica por cima do link. */
function AccessCard({ user, isYou, subject }: { user: AccessUser; isYou: boolean; subject: ViewSubject | null }) {
  const { enter } = usePreviewToggle();
  return (
    <li className="relative rounded-3xl border border-line bg-surface/60 p-4 transition-colors hover:border-line-strong hover:bg-surface sm:p-5">
      <div className="flex items-center gap-4">
        <PersonAvatar name={displayName(user)} src={user.avatarUrl} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <Link
              to={accessPath(user.id)}
              className="truncate font-semibold text-white after:absolute after:inset-0 after:rounded-3xl hover:text-electric-soft focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-electric"
            >
              {displayName(user)}
            </Link>
            <RoleBadge role={user.role} />
            {isYou && (
              <span className="rounded-full border border-electric/40 bg-electric/10 px-2 py-0.5 text-[0.68rem] font-semibold text-electric-soft">Você</span>
            )}
          </p>
          <p className="mt-0.5 truncate text-sm text-fog">{user.email}</p>
          <p className="text-xs text-mist">{user.whatsapp ? `WhatsApp ${formatPhone(user.whatsapp)}` : "Sem WhatsApp cadastrado"}</p>
        </div>
        <span className="hidden items-center gap-1 text-sm font-medium text-electric-soft sm:flex">
          Abrir ficha <ChevronRight aria-hidden className="size-4" />
        </span>
        <ChevronRight aria-hidden className="size-5 text-mist sm:hidden" />
      </div>
      <div className="mt-4">
        <AccessFacts user={user} />
      </div>
      {subject && (
        <div className="relative z-10 mt-4 flex justify-end border-t border-line pt-4">
          <Button variant="secondary" onClick={() => enter(subject)} aria-label={`Ver o painel como ${subject.name}`}>
            <Eye aria-hidden className="size-4" /> Ver como
          </Button>
        </div>
      )}
    </li>
  );
}

function AccessList({ users, permissionsById }: { users: AccessUser[]; permissionsById: PermissionsById | null }) {
  const { state } = useAdminSession();
  const location = useLocation();
  const navigate = useNavigate();
  const currentEmail = state.status === "signed-in" ? state.session.email : "";
  const [sending, setSending] = useState<AccessToSend | null>(() => createdAccessOf(location.state));

  const closeSending = () => {
    setSending(null);
    // A senha do usuário recém-criado não fica no histórico do navegador.
    if (location.state) navigate(location.pathname, { replace: true, state: null });
  };

  return (
    <>
      <ul aria-label="Usuários" className="grid gap-3">
        {users.map((user) => (
          <AccessCard key={user.id} user={user} isYou={sameEmail(user.email, currentEmail)} subject={subjectOf(user, permissionsById)} />
        ))}
      </ul>
      <SendAccessDialog access={sending} onClose={closeSending} />
    </>
  );
}

/** TI da desenvolvedora: todos os usuários do sistema; cada um abre uma ficha com e-mail, senha e sessões. */
export default function AccessPage() {
  const { state } = useAdminSession();
  const role: AdminRole = state.status === "signed-in" ? state.session.role : "admin";
  const users = useAdminQuery((deps) => listAccessUsers(deps, role), `access-users-${role}`);
  const staff = useAdminQuery(listAdminUsers, "access-staff-permissions");
  const permissionsById: PermissionsById | null =
    staff.status === "success" ? new Map(staff.data.map((user) => [user.id, user.permissions])) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Acessos"
        description="Sua área de TI: clique num usuário para trocar e-mail e senha, mandar o acesso pelo WhatsApp e cuidar das sessões. Em “Ver como” você abre o painel exatamente como a pessoa vê."
        action={
          <ButtonLink to={NEW_ACCESS_PATH}>
            <UserPlus aria-hidden className="size-4" /> Novo usuário
          </ButtonLink>
        }
      />
      {IS_DEMO && (
        <p className="rounded-2xl border border-line bg-surface/60 px-4 py-3 text-sm text-fog">
          Modo demonstração: nada disso muda um acesso de verdade. Com o banco ligado, cada ação vale na hora.
        </p>
      )}
      {users.status === "loading" && <LoadingBlock />}
      {users.status === "error" && <ErrorState message={users.error.message} onRetry={users.reload} />}
      {users.status === "success" && users.data.length === 0 && <EmptyState title="Nenhum usuário" description="Cadastre quem vai usar o sistema." />}
      {users.status === "success" && users.data.length > 0 && <AccessList users={users.data} permissionsById={permissionsById} />}
    </div>
  );
}
