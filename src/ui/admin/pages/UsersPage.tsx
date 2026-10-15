import { Plus, UserMinus } from "lucide-react";
import { useState } from "react";
import { container } from "@/app/container";
import { listAdminUsers, removeAdminUser } from "@/application/admin-use-cases";
import { sameEmail, type AdminUser } from "@/domain/admin-user";
import { Button, ButtonLink } from "@/ui/components/Button";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { Fab, InlineError, LoadingBlock, PageHeader } from "../components/AdminUi";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { PersonAvatar } from "../components/PersonAvatar";
import { useAdminQuery, useMutation } from "../hooks";
import { formatDate } from "../lib/dates";
import { useAdminSession } from "../session";
import { useToast } from "../toast";

const IS_DEMO = container.mode === "demo";

const displayName = (user: AdminUser) => user.name ?? user.email;

interface UserRowProps {
  user: AdminUser;
  isYou: boolean;
  /** Falso para você mesmo e para o último usuário: o sistema nunca fica sem acesso. */
  canRemove: boolean;
  onRemove: (user: AdminUser) => void;
}

function UserRow({ user, isYou, canRemove, onRemove }: UserRowProps) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-5">
      <PersonAvatar name={displayName(user)} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2">
          <span className="truncate font-semibold text-white">{displayName(user)}</span>
          {isYou && (
            <span className="rounded-full border border-electric/40 bg-electric/10 px-2 py-0.5 text-[0.68rem] font-semibold text-electric-soft">
              Você
            </span>
          )}
        </p>
        <p className="truncate text-xs text-mist">{user.email}</p>
      </div>
      <p className="text-xs text-mist sm:w-44 sm:text-right">
        {user.lastSignInAt ? `Último acesso em ${formatDate(user.lastSignInAt)}` : "Ainda não entrou"}
        <span className="block">Desde {formatDate(user.createdAt)}</span>
      </p>
      {canRemove && (
        <Button variant="ghost" className="text-[#ff7a7a] hover:text-[#ff9a9a] max-sm:w-full" onClick={() => onRemove(user)}>
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
        description="Quem entra no sistema. Todos têm acesso completo."
        action={
          <ButtonLink to="/admin/usuarios/novo" className="max-md:hidden">
            <Plus aria-hidden className="size-4" /> Novo usuário
          </ButtonLink>
        }
      />

      {IS_DEMO && (
        <p className="rounded-2xl border border-line bg-surface/60 px-4 py-3 text-sm text-fog">
          Modo demonstração: a lista fica só neste navegador e ninguém consegue entrar com ela. Com o banco ligado, cada usuário
          entra com o próprio e-mail e senha.
        </p>
      )}
      {remove.error && <InlineError message={remove.error.message} />}
      {users.status === "loading" && <LoadingBlock />}
      {users.status === "error" && <ErrorState message={users.error.message} onRetry={users.reload} />}
      {users.status === "success" && users.data.length === 0 && (
        <EmptyState title="Nenhum usuário" description="Cadastre quem vai ajudar a cuidar da loja." />
      )}
      {users.status === "success" && users.data.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface/40">
          {users.data.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              isYou={sameEmail(user.email, currentEmail)}
              canRemove={users.data.length > 1 && !sameEmail(user.email, currentEmail)}
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
