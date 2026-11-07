import { KeyRound, LogOut, MessageCircle, Pencil, ShieldCheck, ShieldOff, UserPlus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { container } from "@/app/container";
import { endAccessSessions, listAccessUsers, resetAccessMfa } from "@/application/access-use-cases";
import type { AccessUser } from "@/domain/access-user";
import { sameEmail, type AdminRole } from "@/domain/admin-user";
import { Button, ButtonLink } from "@/ui/components/Button";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { cn } from "@/ui/lib/cn";
import { InlineError, LoadingBlock, PageHeader } from "../components/AdminUi";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { PersonAvatar } from "../components/PersonAvatar";
import { RoleBadge } from "../components/RoleBadge";
import { useAdminQuery, useMutation } from "../hooks";
import { formatDate, formatRelative } from "../lib/dates";
import { formatPhone } from "../lib/whatsapp";
import { EditAccessDialog, PasswordDialog } from "../access/AccessDialogs";
import { SendAccessDialog, type AccessToSend } from "../access/SendAccessDialog";
import { NEW_ACCESS_PATH } from "../navigation";
import { useAdminSession } from "../session";
import { useToast } from "../toast";

const IS_DEMO = container.mode === "demo";

const displayName = (user: AccessUser) => user.name ?? user.email;

type Danger = { kind: "sessions" | "mfa"; user: AccessUser };

/** Usuário recém-criado que a ficha de novo usuário manda para cá, para já mandar o acesso. */
function createdAccessOf(state: unknown): AccessToSend | null {
  if (typeof state !== "object" || state === null || !("createdAccess" in state)) return null;
  const value = (state as { createdAccess: unknown }).createdAccess;
  if (typeof value !== "object" || value === null) return null;
  const { name, email, password } = value as Record<string, unknown>;
  if (typeof email !== "string" || typeof password !== "string") return null;
  return { name: typeof name === "string" ? name : null, email, password, whatsapp: null };
}

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

interface CardProps {
  user: AccessUser;
  isYou: boolean;
  onEdit: () => void;
  onPassword: () => void;
  onSend: () => void;
  onDanger: (kind: Danger["kind"]) => void;
}

function AccessCard({ user, isYou, onEdit, onPassword, onSend, onDanger }: CardProps) {
  return (
    <li className="rounded-3xl border border-line bg-surface/60 p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-4">
        <PersonAvatar name={displayName(user)} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="truncate font-semibold text-white">{displayName(user)}</span>
            <RoleBadge role={user.role} />
            {isYou && (
              <span className="rounded-full border border-electric/40 bg-electric/10 px-2 py-0.5 text-[0.68rem] font-semibold text-electric-soft">Você</span>
            )}
          </p>
          <p className="mt-0.5 truncate text-sm text-fog">{user.email}</p>
          <p className="text-xs text-mist">{user.whatsapp ? `WhatsApp ${formatPhone(user.whatsapp)}` : "Sem WhatsApp cadastrado"}</p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-2xl border border-line bg-ink/50 p-3 text-xs sm:grid-cols-4">
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

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onEdit}>
          <Pencil aria-hidden className="size-4" /> Editar dados
        </Button>
        <Button variant="secondary" onClick={onPassword}>
          <KeyRound aria-hidden className="size-4" /> Nova senha
        </Button>
        <Button variant="secondary" onClick={onSend} title="Mensagem com link e e-mail, sem senha">
          <MessageCircle aria-hidden className="size-4 text-[#25d366]" /> Mandar link de acesso
        </Button>
        {!isYou && user.activeSessions > 0 && (
          <Button variant="ghost" onClick={() => onDanger("sessions")} className="text-[#ff9a9a] hover:text-[#ffb3b3]">
            <LogOut aria-hidden className="size-4" /> Encerrar sessões
          </Button>
        )}
        {user.mfaEnabled && (
          <Button variant="ghost" onClick={() => onDanger("mfa")} className="text-[#ff9a9a] hover:text-[#ffb3b3]">
            <ShieldOff aria-hidden className="size-4" /> Desligar duas etapas
          </Button>
        )}
      </div>
    </li>
  );
}

const DANGER_COPY: Record<Danger["kind"], { title: string; description: string; confirm: string; done: string }> = {
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

function AccessList({ role, users, reload }: { role: AdminRole; users: AccessUser[]; reload: () => void }) {
  const toast = useToast();
  const { state } = useAdminSession();
  const location = useLocation();
  const navigate = useNavigate();
  const currentEmail = state.status === "signed-in" ? state.session.email : "";
  const [editing, setEditing] = useState<AccessUser | null>(null);
  const [passwordFor, setPasswordFor] = useState<AccessUser | null>(null);
  const [sending, setSending] = useState<AccessToSend | null>(() => createdAccessOf(location.state));
  const [danger, setDanger] = useState<Danger | null>(null);
  const act = useMutation(async (deps, target: Danger) => {
    if (target.kind === "sessions") await endAccessSessions(deps, role, target.user.id);
    else await resetAccessMfa(deps, role, target.user.id);
    return target.kind;
  });

  const onConfirmDanger = async () => {
    if (!danger) return;
    const done = await act.run(danger);
    setDanger(null);
    if (!done) return;
    toast.show(DANGER_COPY[done].done);
    reload();
  };

  const closeSending = () => {
    setSending(null);
    // A senha do usuário recém-criado não fica no histórico do navegador.
    if (location.state) navigate(location.pathname, { replace: true, state: null });
  };

  return (
    <>
      {act.error && <InlineError message={act.error.message} />}
      <ul className="grid gap-3">
        {users.map((user) => (
          <AccessCard
            key={user.id}
            user={user}
            isYou={sameEmail(user.email, currentEmail)}
            onEdit={() => setEditing(user)}
            onPassword={() => setPasswordFor(user)}
            onSend={() => setSending({ name: user.name, email: user.email, whatsapp: user.whatsapp, password: null })}
            onDanger={(kind) => setDanger({ kind, user })}
          />
        ))}
      </ul>

      <EditAccessDialog
        user={editing}
        role={role}
        onClose={() => setEditing(null)}
        onSaved={(update) => {
          setEditing(null);
          toast.show(`Dados de ${update.name} salvos.`);
          reload();
        }}
      />
      <PasswordDialog
        user={passwordFor}
        role={role}
        onClose={() => setPasswordFor(null)}
        onSaved={(password) => {
          const user = passwordFor;
          setPasswordFor(null);
          if (user) setSending({ name: user.name, email: user.email, whatsapp: user.whatsapp, password });
          toast.show("Senha trocada.");
          reload();
        }}
      />
      <SendAccessDialog access={sending} onClose={closeSending} />
      <ConfirmDialog
        open={danger !== null}
        title={danger ? DANGER_COPY[danger.kind].title : ""}
        description={
          <>
            <strong className="text-white">{danger ? displayName(danger.user) : ""}</strong>: {danger ? DANGER_COPY[danger.kind].description : ""}
          </>
        }
        confirmLabel={danger ? DANGER_COPY[danger.kind].confirm : ""}
        pending={act.pending}
        onConfirm={() => void onConfirmDanger()}
        onClose={() => setDanger(null)}
      />
    </>
  );
}

/** TI da desenvolvedora: quem acessa o sistema, como está o acesso de cada um e o que fazer quando algo dá errado. */
export default function AccessPage() {
  const { state } = useAdminSession();
  const role: AdminRole = state.status === "signed-in" ? state.session.role : "admin";
  const users = useAdminQuery((deps) => listAccessUsers(deps, role), `access-users-${role}`);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Acessos"
        description="Sua área de TI: troque e-mail e senha, mande o acesso pelo WhatsApp, encerre sessões e ajude com as duas etapas."
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
      {users.status === "success" && users.data.length > 0 && <AccessList role={role} users={users.data} reload={users.reload} />}
    </div>
  );
}
