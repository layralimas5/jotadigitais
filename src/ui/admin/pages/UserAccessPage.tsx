import { ArrowLeft, Save } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { listAdminUsers, setAdminUserAccess } from "@/application/admin-use-cases";
import { adminUserAccessSchema, fieldErrorsOf } from "@/application/schemas";
import { sameEmail, type AdminRole, type AdminUser, type AdminUserAccess } from "@/domain/admin-user";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { AccessProfileForm } from "../access/AccessProfileForm";
import { SendAccessDialog, type AccessToSend } from "../access/SendAccessDialog";
import { useViewRole } from "../admin-view";
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

/** Admin ou ajudante e as áreas liberadas: um formulário à parte, porque vale sem mexer no login. */
function PermissionsForm({ user, currentEmail, reload }: { user: AdminUser; currentEmail: string; reload: () => void }) {
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
    reload();
  };

  return (
    <form noValidate onSubmit={onSubmit} aria-busy={save.pending} className="grid max-w-3xl gap-6">
      <AccessFields value={access} onChange={setAccess} error={error} />
      <FormFooter
        submitLabel="Salvar o que pode fazer"
        mobileSubmitLabel="Salvar"
        submitIcon={<Save aria-hidden className="size-4" />}
        pending={save.pending}
        onCancel={() => navigate(USERS_PATH)}
        errors={[save.error?.message]}
      />
    </form>
  );
}

function Notice({ children }: { children: string }) {
  return <p className="mt-6 max-w-3xl rounded-2xl border border-line bg-surface/60 px-4 py-3 text-sm text-fog">{children}</p>;
}

interface RecordProps {
  user: AdminUser;
  viewerRole: AdminRole;
  currentEmail: string;
  reload: () => void;
  onSend: (access: AccessToSend) => void;
}

/** Ficha do usuário: dados de acesso (e-mail, WhatsApp, senha nova) e o que a pessoa pode fazer no sistema. */
function UserRecord({ user, viewerRole, currentEmail, reload, onSend }: RecordProps) {
  const navigate = useNavigate();
  if (user.role === "developer") return <Notice>O acesso da desenvolvedora não muda por aqui.</Notice>;
  if (sameEmail(user.email, currentEmail)) {
    return <Notice>Esta é a sua ficha. Seu nome, e-mail e senha você muda em Configurações; o seu acesso só outro admin muda.</Notice>;
  }
  // As chaves remontam cada formulário com os dados novos depois de salvar.
  return (
    <div className="mt-6 space-y-8">
      <AccessProfileForm
        key={`${user.email}|${user.name ?? ""}|${user.whatsapp ?? ""}`}
        user={user}
        viewerRole={viewerRole}
        reload={reload}
        onSend={onSend}
        onCancel={() => navigate(USERS_PATH)}
      />
      <PermissionsForm key={`${user.role}|${user.permissions.join()}`} user={user} currentEmail={currentEmail} reload={reload} />
    </div>
  );
}

/** Usuários > Editar acesso: o Jota troca e-mail e senha, manda o acesso pelo WhatsApp e escolhe o que cada um pode fazer. */
export default function UserAccessPage() {
  const { id = "" } = useParams();
  const { state } = useAdminSession();
  const viewerRole = useViewRole() ?? "admin";
  const currentEmail = state.status === "signed-in" ? state.session.email : "";
  const users = useAdminQuery(listAdminUsers, "admin-users");
  const user = users.status === "success" ? (users.data.find((item) => item.id === id) ?? null) : null;
  const [sending, setSending] = useState<AccessToSend | null>(null);

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
          <UserRecord user={user} viewerRole={viewerRole} currentEmail={currentEmail} reload={users.reload} onSend={setSending} />
        </>
      )}
      <SendAccessDialog access={sending} onClose={() => setSending(null)} />
    </>
  );
}
