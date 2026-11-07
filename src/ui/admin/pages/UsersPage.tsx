import { Plus, SlidersHorizontal, UserMinus } from "lucide-react";
import { useState } from "react";
import { listAdminUsers, removeAdminUser } from "@/application/admin-use-cases";
import { sameEmail, STAFF_PERMISSION_LABEL, type AdminUser } from "@/domain/admin-user";
import { Button, ButtonLink } from "@/ui/components/Button";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { Fab, InlineError, LoadingBlock, PageHeader } from "../components/AdminUi";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { PersonAvatar } from "../components/PersonAvatar";
import { RoleBadge } from "../components/RoleBadge";
import { useAdminQuery, useMutation } from "../hooks";
import { formatDate } from "../lib/dates";
import { useAdminSession } from "../session";
import { useToast } from "../toast";
import { ExampleUsersNotice } from "../users/ExampleUsersNotice";


const displayName = (user: AdminUser) => user.name ?? user.email;

interface UserRowProps {
  user: AdminUser;
  isYou: boolean;
  /** Falso para você mesmo e para o último admin: o sistema nunca fica sem acesso completo. */
  canRemove: boolean;
  /** Falso para você mesmo e para a desenvolvedora. */
  canEditAccess: boolean;
  onRemove: (user: AdminUser) => void;
}

/** Áreas liberadas do ajudante, em etiquetas pequenas. */
function PermissionChips({ user }: { user: AdminUser }) {
  if (user.role !== "helper") return null;
  if (user.permissions.length === 0) return <p className="mt-1 text-xs text-mist">Nenhuma área liberada</p>;
  return (
    <ul aria-label="Áreas liberadas" className="mt-1.5 flex flex-wrap gap-1">
      {user.permissions.map((permission) => (
        <li key={permission} className="rounded-full border border-line-strong px-2 py-0.5 text-[0.68rem] text-fog">
          {STAFF_PERMISSION_LABEL[permission]}
        </li>
      ))}
    </ul>
  );
}

function UserRow({ user, isYou, canRemove, canEditAccess, onRemove }: UserRowProps) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-5">
      <PersonAvatar name={displayName(user)} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2">
          <span className="truncate font-semibold text-white">{displayName(user)}</span>
          <RoleBadge role={user.role} />
          {isYou && (
            <span className="rounded-full border border-electric/40 bg-electric/10 px-2 py-0.5 text-[0.68rem] font-semibold text-electric-soft">
              Você
            </span>
          )}
        </p>
        <p className="truncate text-xs text-mist">{user.email}</p>
        <PermissionChips user={user} />
      </div>
      <p className="text-xs text-mist sm:w-44 sm:text-right">
        {user.lastSignInAt ? `Último acesso em ${formatDate(user.lastSignInAt)}` : "Ainda não entrou"}
        <span className="block">Desde {formatDate(user.createdAt)}</span>
      </p>
      {canEditAccess && (
        <ButtonLink to={`/admin/usuarios/${user.id}`} variant="secondary" className="max-sm:flex-1">
          <SlidersHorizontal aria-hidden className="size-4" /> Editar acesso
        </ButtonLink>
      )}
      {canRemove && (
        <Button variant="ghost" className="text-[#ff7a7a] hover:text-[#ff9a9a] max-sm:flex-1" onClick={() => onRemove(user)}>
          <UserMinus aria-hidden className="size-4" /> Tirar acesso
        </Button>
      )}
    </li>
  );
}

export default function UsersPage() {
  const users = useAdminQuery(listAdminUsers, "admin-users");
  const { state } = useAdminSession();
  const toast = useToast();
  const [toRemove, setToRemove] = useState<AdminUser | null>(null);
  const currentEmail = state.status === "signed-in" ? state.session.email : "";
  const remove = useMutation(async (deps, user: AdminUser) => {
    await removeAdminUser(deps, user, currentEmail);
    return true;
  });

  const onConfirm = async () => {
    if (!toRemove) return;
    const removed = await remove.run(toRemove);
    setToRemove(null);
    if (!removed) return;
    toast.show(`${displayName(toRemove)} não tem mais acesso ao sistema.`);
    users.reload();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuários"
        description="Quem entra no sistema. Admin tem acesso completo; ajudante vê só as áreas que você liberar."
        action={
          <ButtonLink to="/admin/usuarios/novo" className="max-md:hidden">
            <Plus aria-hidden className="size-4" /> Novo usuário
          </ButtonLink>
        }
      />

      <ExampleUsersNotice />
      {remove.error && <InlineError message={remove.error.message} />}
      {users.status === "loading" && <LoadingBlock />}
      {users.status === "error" && <ErrorState message={users.error.message} onRetry={users.reload} />}
      {users.status === "success" && users.data.length === 0 && (
        <EmptyState title="Nenhum usuário" description="Cadastre quem vai ajudar a cuidar da loja e escolha o que cada um pode ver." />
      )}
      {users.status === "success" && users.data.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface/40">
          {users.data.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              isYou={sameEmail(user.email, currentEmail)}
              canRemove={!sameEmail(user.email, currentEmail) && (user.role !== "admin" || users.data.filter((item) => item.role === "admin").length > 1)}
              canEditAccess={!sameEmail(user.email, currentEmail) && user.role !== "developer"}
              onRemove={setToRemove}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={toRemove !== null}
        title="Tirar o acesso deste usuário?"
        description={
          <>
            <strong className="text-white">{toRemove ? displayName(toRemove) : ""}</strong> deixa de entrar no sistema na hora. Os
            dados da loja não mudam.
          </>
        }
        confirmLabel="Tirar acesso"
        pending={remove.pending}
        onConfirm={() => void onConfirm()}
        onClose={() => setToRemove(null)}
      />
      <Fab to="/admin/usuarios/novo" label="Novo usuário" />
    </div>
  );
}
