import { ArrowLeft, LogOut, ShieldOff } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { endAccessSessions, listAccessUsers, resetAccessMfa } from "@/application/access-use-cases";
import type { AccessUser } from "@/domain/access-user";
import { sameEmail, type AdminRole } from "@/domain/admin-user";
import { Button } from "@/ui/components/Button";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { InlineError, LoadingBlock, PageHeader } from "../components/AdminUi";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { RoleBadge } from "../components/RoleBadge";
import { useAdminQuery, useMutation } from "../hooks";
import { AccessFacts, displayName } from "../access/AccessParts";
import { AccessProfileForm } from "../access/AccessProfileForm";
import { SendAccessDialog, type AccessToSend } from "../access/SendAccessDialog";
import { ACCESS_PATH } from "../navigation";
import { useAdminSession } from "../session";
import { useToast } from "../toast";

type Danger = "sessions" | "mfa";

const DANGER_COPY: Record<Danger, { title: string; description: string; confirm: string; done: string }> = {
  sessions: {
    title: "Encerrar as sessões?",
    description: "A pessoa sai do sistema em todos os aparelhos na hora e precisa entrar de novo com e-mail e senha.",
    confirm: "Encerrar sessões",
    done: "Sessões encerradas.",
  },
  mfa: {
    title: "Desligar a verificação em duas etapas?",
    description: "Use quando a pessoa perdeu o celular do app autenticador. Ela entra só com a senha e cadastra de novo em Configurações.",
    confirm: "Desligar duas etapas",
    done: "Verificação em duas etapas desligada.",
  },
};

interface AccessFormProps {
  user: AccessUser;
  role: AdminRole;
  isYou: boolean;
  reload: () => void;
  onSend: (access: AccessToSend) => void;
}

function AccessForm({ user, role, isYou, reload, onSend }: AccessFormProps) {
  const toast = useToast();
  const navigate = useNavigate();
  const [danger, setDanger] = useState<Danger | null>(null);

  const act = useMutation(async (deps, kind: Danger) => {
    if (kind === "sessions") await endAccessSessions(deps, role, user.id);
    else await resetAccessMfa(deps, role, user.id);
    return kind;
  });

  const onConfirmDanger = async () => {
    if (!danger) return;
    const done = await act.run(danger);
    setDanger(null);
    if (!done) return;
    toast.show(DANGER_COPY[done].done);
    reload();
  };

  return (
    <>
      <div className="mt-6">
        <AccessProfileForm user={user} viewerRole={role} reload={reload} onSend={onSend} onCancel={() => navigate(ACCESS_PATH)} />
      </div>

      <section aria-labelledby="sessao" className="mt-6 max-w-3xl space-y-4 rounded-3xl border border-line bg-surface/60 p-5 sm:p-6">
        <h2 id="sessao" className="font-display text-base font-semibold text-white">
          Sessões e segurança
        </h2>
        <AccessFacts user={user} />
        {act.error && <InlineError message={act.error.message} />}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            onClick={() => setDanger("sessions")}
            disabled={isYou || user.activeSessions === 0}
            title={isYou ? "Para sair, use o menu do topo" : undefined}
            className="text-[#ff9a9a] hover:text-[#ffb3b3]"
          >
            <LogOut aria-hidden className="size-4" /> Encerrar sessões
          </Button>
          <Button variant="ghost" onClick={() => setDanger("mfa")} disabled={!user.mfaEnabled} className="text-[#ff9a9a] hover:text-[#ffb3b3]">
            <ShieldOff aria-hidden className="size-4" /> Desligar duas etapas
          </Button>
        </div>
      </section>

      <ConfirmDialog
        open={danger !== null}
        title={danger ? DANGER_COPY[danger].title : ""}
        description={
          <>
            <strong className="text-white">{displayName(user)}</strong>: {danger ? DANGER_COPY[danger].description : ""}
          </>
        }
        confirmLabel={danger ? DANGER_COPY[danger].confirm : ""}
        pending={act.pending}
        onConfirm={() => void onConfirmDanger()}
        onClose={() => setDanger(null)}
      />
    </>
  );
}

/** Ficha de um usuário na TI: dados, senha nova, envio do acesso e sessões. */
export default function AccessUserPage() {
  const { id = "" } = useParams();
  const { state } = useAdminSession();
  const role: AdminRole = state.status === "signed-in" ? state.session.role : "admin";
  const currentEmail = state.status === "signed-in" ? state.session.email : "";
  const users = useAdminQuery((deps) => listAccessUsers(deps, role), `access-users-${role}`);
  const user = users.status === "success" ? (users.data.find((item) => item.id === id) ?? null) : null;
  const [sending, setSending] = useState<AccessToSend | null>(null);

  return (
    <>
      <Link to={ACCESS_PATH} className="inline-flex items-center gap-2 text-sm text-mist hover:text-white">
        <ArrowLeft aria-hidden className="size-4" /> Voltar
      </Link>
      {users.status === "loading" && <LoadingBlock />}
      {users.status === "error" && <ErrorState message={users.error.message} onRetry={users.reload} />}
      {users.status === "success" && !user && (
        <div className="mt-6">
          <EmptyState title="Usuário não encontrado" description="Ele pode ter sido removido. Volte para a lista de acessos." />
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
          {/* A chave remonta o formulário com os dados novos depois de salvar. */}
          <AccessForm
            key={`${user.email}|${user.name ?? ""}|${user.whatsapp ?? ""}`}
            user={user}
            role={role}
            isYou={sameEmail(user.email, currentEmail)}
            reload={users.reload}
            onSend={setSending}
          />
        </>
      )}
      <SendAccessDialog access={sending} onClose={() => setSending(null)} />
    </>
  );
}
