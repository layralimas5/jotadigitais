import { ArrowLeft, Save } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { listAdminUsers, setAdminUserAccess } from "@/application/admin-use-cases";
import { adminUserAccessSchema, fieldErrorsOf } from "@/application/schemas";
import { sameEmail, type AdminUser, type AdminUserAccess } from "@/domain/admin-user";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { LoadingBlock, PageHeader } from "../components/AdminUi";
import { FormFooter } from "../components/FormFooter";
import { RoleBadge } from "../components/RoleBadge";
import { useAdminQuery, useMutation } from "../hooks";
import { useAdminSession } from "../session";
import { useToast } from "../toast";
import { AccessFields } from "../users/AccessFields";

const USERS_PATH = "/admin/usuarios";

const displayName = (user: AdminUser) => user.name ?? user.email;

const initialAccess = (user: AdminUser): AdminUserAccess => ({
  role: user.role === "helper" ? "helper" : "admin",
  permissions: user.permissions,
});

function AccessForm({ user, currentEmail }: { user: AdminUser; currentEmail: string }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [access, setAccess] = useState<AdminUserAccess>(() => initialAccess(user));
  const [error, setError] = useState<string | undefined>();
  const save = useMutation(async (deps, next: AdminUserAccess) => {
    await setAdminUserAccess(deps, user, currentEmail, next);
    return true;
  });

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = adminUserAccessSchema.safeParse(access);
    if (!result.success) {
      setError(fieldErrorsOf(result.error).permissions);
      return;
    }
    setError(undefined);
    if (!(await save.run(result.data))) return;
    toast.show(`Acesso de ${displayName(user)} atualizado. Vale a partir da próxima tela que a pessoa abrir.`);
    navigate(USERS_PATH);
  };

  return (
    <form noValidate onSubmit={onSubmit} aria-busy={save.pending} className="mt-6 grid max-w-3xl gap-6">
      <AccessFields value={access} onChange={setAccess} error={error} />
      <FormFooter
        submitLabel="Salvar acesso"
        mobileSubmitLabel="Salvar"
        submitIcon={<Save aria-hidden className="size-4" />}
        pending={save.pending}
        onCancel={() => navigate(USERS_PATH)}
        errors={[save.error?.message]}
      />
    </form>
  );
}

/** Troca entre admin e ajudante e liga ou desliga as áreas do ajudante. O próprio acesso e o da desenvolvedora não mudam aqui. */
export default function UserAccessPage() {
  const { id = "" } = useParams();
  const { state } = useAdminSession();
  const currentEmail = state.status === "signed-in" ? state.session.email : "";
  const users = useAdminQuery(listAdminUsers, "admin-users");
  const user = users.status === "success" ? (users.data.find((item) => item.id === id) ?? null) : null;
  const locked = user !== null && (sameEmail(user.email, currentEmail) || user.role === "developer");

  return (
    <>
      <Link to={USERS_PATH} className="inline-flex items-center gap-2 text-sm text-mist hover:text-white">
        <ArrowLeft aria-hidden className="size-4" /> Voltar
      </Link>
      {users.status === "loading" && <LoadingBlock />}
      {users.status === "error" && <ErrorState message={users.error.message} onRetry={users.reload} />}
      {users.status === "success" && !user && (
        <div className="mt-6">
          <EmptyState title="Usuário não encontrado" description="Ele pode ter sido removido. Volte para a lista de usuários." />
        </div>
      )}
      {user && (
        <>
          <div className="mt-4">
            <PageHeader
              title={displayName(user)}
              description={
                <span className="flex flex-wrap items-center gap-2">
                  <RoleBadge role={user.role} /> {user.email}
                </span>
              }
            />
          </div>
          {locked ? (
            <p className="mt-6 max-w-3xl rounded-2xl border border-line bg-surface/60 px-4 py-3 text-sm text-fog">
              {user.role === "developer"
                ? "O acesso da desenvolvedora não muda por aqui."
                : "Você não muda o seu próprio acesso. Peça para outro admin fazer isso."}
            </p>
          ) : (
            <AccessForm key={`${user.role}|${user.permissions.join()}`} user={user} currentEmail={currentEmail} />
          )}
        </>
      )}
    </>
  );
}
