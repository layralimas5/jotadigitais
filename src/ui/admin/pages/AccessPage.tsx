import { ChevronRight, Eye, UserPlus } from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { container } from "@/app/container";
import { listAccessUsers } from "@/application/access-use-cases";
import { listAdminUsers } from "@/application/admin-use-cases";
import type { AccessUser } from "@/domain/access-user";
import { sameEmail, type AdminRole, type StaffPermission } from "@/domain/admin-user";
import { Button, ButtonLink } from "@/ui/components/Button";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { LoadingBlock, PageHeader } from "../components/AdminUi";
import { Modal } from "../components/Modal";
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

function YouBadge() {
  return <span className="rounded-full border border-electric/40 bg-electric/10 px-2 py-0.5 text-[0.68rem] font-semibold text-electric-soft">Você</span>;
}

/** Linha da lista: clicar abre o card flutuante com os detalhes e as ações. */
function AccessRow({ user, isYou, onOpen }: { user: AccessUser; isYou: boolean; onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03] focus-visible:bg-white/[0.04] focus-visible:outline-none sm:px-5"
      >
        <PersonAvatar name={displayName(user)} src={user.avatarUrl} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate font-semibold text-white">{displayName(user)}</span>
            <RoleBadge role={user.role} />
            {isYou && <YouBadge />}
          </span>
          <span className="block truncate text-sm text-mist">{user.email}</span>
        </span>
        <ChevronRight aria-hidden className="size-5 shrink-0 text-mist" />
      </button>
    </li>
  );
}

/** Card flutuante no meio da tela: os dados do acesso e o caminho para a ficha e para o "Ver como". */
function AccessDetailCard({
  user,
  isYou,
  subject,
  onClose,
}: {
  user: AccessUser | null;
  isYou: boolean;
  subject: ViewSubject | null;
  onClose: () => void;
}) {
  const { enter } = usePreviewToggle();
  return (
    <Modal open={user !== null} title={user ? displayName(user) : ""} onClose={onClose} placement="center">
      {user && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <PersonAvatar name={displayName(user)} src={user.avatarUrl} />
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2">
                <RoleBadge role={user.role} />
                {isYou && <YouBadge />}
              </p>
              <p className="mt-1 truncate text-sm text-fog">{user.email}</p>
              <p className="text-xs text-mist">{user.whatsapp ? `WhatsApp ${formatPhone(user.whatsapp)}` : "Sem WhatsApp cadastrado"}</p>
            </div>
          </div>
          <AccessFacts user={user} />
          <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
            {subject && (
              <Button variant="secondary" onClick={() => enter(subject)}>
                <Eye aria-hidden className="size-4" /> Ver como
              </Button>
            )}
            <ButtonLink to={accessPath(user.id)}>
              Abrir ficha <ChevronRight aria-hidden className="size-4" />
            </ButtonLink>
          </div>
        </div>
      )}
    </Modal>
  );
}

function AccessList({ users, permissionsById }: { users: AccessUser[]; permissionsById: PermissionsById | null }) {
  const { state } = useAdminSession();
  const location = useLocation();
  const navigate = useNavigate();
  const currentEmail = state.status === "signed-in" ? state.session.email : "";
  const [sending, setSending] = useState<AccessToSend | null>(() => createdAccessOf(location.state));
  const [openId, setOpenId] = useState<string | null>(null);
  const openUser = users.find((user) => user.id === openId) ?? null;

  const closeSending = () => {
    setSending(null);
    // A senha do usuário recém-criado não fica no histórico do navegador.
    if (location.state) navigate(location.pathname, { replace: true, state: null });
  };

  return (
    <>
      <ul aria-label="Usuários" className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface/60">
        {users.map((user) => (
          <AccessRow key={user.id} user={user} isYou={sameEmail(user.email, currentEmail)} onOpen={() => setOpenId(user.id)} />
        ))}
      </ul>
      <AccessDetailCard
        user={openUser}
        isYou={openUser ? sameEmail(openUser.email, currentEmail) : false}
        subject={openUser ? subjectOf(openUser, permissionsById) : null}
        onClose={() => setOpenId(null)}
      />
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
      <section aria-labelledby="access-staff-title" className="space-y-3">
        <h2 id="access-staff-title" className="font-display text-lg font-semibold text-white">Equipe da loja</h2>
        {users.status === "success" && users.data.length > 0 && <AccessList users={users.data} permissionsById={permissionsById} />}
      </section>
    </div>
  );
}
