import { ArrowLeft, Copy, KeyRound, LogOut, MessageCircle, RefreshCw, Save, ShieldOff } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { endAccessSessions, listAccessUsers, resetAccessMfa, setAccessPassword, updateAccessProfile } from "@/application/access-use-cases";
import { accessPasswordSchema, accessProfileSchema, fieldErrorsOf, PASSWORD_RULE_HINT } from "@/application/schemas";
import type { AccessUser } from "@/domain/access-user";
import { sameEmail, type AdminRole } from "@/domain/admin-user";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/form/Fields";
import { PasswordField } from "@/ui/components/form/PasswordField";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { FormSection, InlineError, LoadingBlock, PageHeader } from "../components/AdminUi";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { FormFooter } from "../components/FormFooter";
import { RoleBadge } from "../components/RoleBadge";
import { generatePassword } from "../emails/generate-password";
import { useCopy } from "../emails/use-copy";
import { useAdminQuery, useMutation } from "../hooks";
import { formatPhone } from "../lib/whatsapp";
import { AccessFacts, displayName } from "../access/AccessParts";
import { SendAccessDialog, type AccessToSend } from "../access/SendAccessDialog";
import { ACCESS_PATH } from "../navigation";
import { useAdminSession } from "../session";
import { useToast } from "../toast";

interface FormValues {
  name: string;
  email: string;
  whatsapp: string;
  /** Vazia: a senha continua a mesma. */
  password: string;
}

interface SaveInput {
  profile: { name: string; email: string; whatsapp: string | null } | null;
  password: string | null;
}

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

const initialValues = (user: AccessUser): FormValues => ({
  name: user.name ?? "",
  email: user.email,
  whatsapp: user.whatsapp ? formatPhone(user.whatsapp) : "",
  password: "",
});

function validate(values: FormValues): { input: SaveInput | null; errors: Record<string, string> } {
  const profile = accessProfileSchema.safeParse({ name: values.name, email: values.email, whatsapp: values.whatsapp || null });
  const password = values.password ? accessPasswordSchema.safeParse({ password: values.password }) : null;
  const errors = {
    ...(profile.success ? {} : fieldErrorsOf(profile.error)),
    ...(password && !password.success ? fieldErrorsOf(password.error) : {}),
  };
  if (!profile.success || (password && !password.success)) return { input: null, errors };
  return { input: { profile: profile.data, password: password?.data.password ?? null }, errors: {} };
}

const profileChanged = (user: AccessUser, profile: NonNullable<SaveInput["profile"]>) =>
  profile.name !== (user.name ?? "") || !sameEmail(profile.email, user.email) || (profile.whatsapp ?? null) !== (user.whatsapp ?? null);

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
  const copy = useCopy();
  const [values, setValues] = useState<FormValues>(() => initialValues(user));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [danger, setDanger] = useState<Danger | null>(null);

  const save = useMutation(async (deps, input: SaveInput) => {
    if (input.profile && profileChanged(user, input.profile)) await updateAccessProfile(deps, role, user.id, input.profile);
    if (input.password) await setAccessPassword(deps, role, user.id, { password: input.password });
    return input;
  });
  const act = useMutation(async (deps, kind: Danger) => {
    if (kind === "sessions") await endAccessSessions(deps, role, user.id);
    else await resetAccessMfa(deps, role, user.id);
    return kind;
  });

  const update = (patch: Partial<FormValues>) => setValues((current) => ({ ...current, ...patch }));
  const emailChanged = !sameEmail(values.email.trim(), user.email);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { input, errors: found } = validate(values);
    setErrors(found);
    if (!input || !input.profile) return;
    if (!profileChanged(user, input.profile) && !input.password) {
      toast.show("Nada mudou.");
      return;
    }
    const saved = await save.run(input);
    if (!saved?.profile) return;
    toast.show(saved.password ? "Dados e senha salvos. Já valem para entrar." : "Dados salvos. Já valem para entrar.");
    // Mudou e-mail ou senha: a mensagem com o acesso novo já abre pronta para mandar.
    if (saved.password || emailChanged) {
      onSend({ name: saved.profile.name, email: saved.profile.email, whatsapp: saved.profile.whatsapp, password: saved.password });
    }
    update({ password: "" });
    reload();
  };

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
      <form noValidate onSubmit={onSubmit} aria-busy={save.pending} className="mt-6 grid max-w-3xl gap-6">
        <FormSection title="Dados de acesso" description="O que você salvar aqui vale na hora: a pessoa passa a entrar com o e-mail novo.">
          <TextField label="Nome" name="name" autoComplete="off" maxLength={80} value={values.name} onChange={(event) => update({ name: event.target.value })} error={errors.name} />
          <TextField
            label="E-mail de acesso"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={values.email}
            onChange={(event) => update({ email: event.target.value })}
            error={errors.email}
            hint={emailChanged ? "E-mail novo: vale sem confirmação, assim que você salvar." : undefined}
          />
          <TextField
            label="WhatsApp"
            name="whatsapp"
            inputMode="tel"
            autoComplete="off"
            placeholder="(84) 98122-5361"
            value={values.whatsapp}
            onChange={(event) => update({ whatsapp: event.target.value })}
            error={errors.whatsapp}
            hint="Usado para mandar o acesso."
          />
        </FormSection>

        <FormSection
          title="Senha"
          description="A senha atual não aparece para ninguém (o sistema guarda só uma versão embaralhada). Para a pessoa entrar, defina uma nova aqui: você vê o que digitou e manda para ela."
        >
          <PasswordField
            label="Senha nova"
            name="password"
            autoComplete="new-password"
            placeholder="Deixe vazio para manter a senha atual"
            initiallyVisible
            value={values.password}
            onChange={(event) => update({ password: event.target.value })}
            error={errors.password}
            hint={PASSWORD_RULE_HINT}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => update({ password: generatePassword(14) })}>
              <RefreshCw aria-hidden className="size-4" /> Gerar senha
            </Button>
            {values.password && (
              <Button variant="secondary" onClick={() => void copy(values.password, "Senha copiada.")}>
                <Copy aria-hidden className="size-4" /> Copiar senha
              </Button>
            )}
          </div>
        </FormSection>

        <FormFooter
          submitLabel={values.password ? "Salvar e trocar a senha" : "Salvar dados"}
          mobileSubmitLabel="Salvar"
          submitIcon={values.password ? <KeyRound aria-hidden className="size-4" /> : <Save aria-hidden className="size-4" />}
          pending={save.pending}
          onCancel={() => navigate(ACCESS_PATH)}
          errors={[save.error?.message]}
          extraActions={
            <Button
              variant="secondary"
              onClick={() => onSend({ name: user.name, email: user.email, whatsapp: user.whatsapp, password: null })}
            >
              <MessageCircle aria-hidden className="size-4 text-[#25d366]" /> Mandar link de acesso
            </Button>
          }
        />
      </form>

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
