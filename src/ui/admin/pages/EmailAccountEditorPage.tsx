import { ArrowLeft } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { deleteEmailAccount, findEmailAccount, saveEmailAccount } from "@/application/admin-use-cases";
import { emailAccountDataSchema, fieldErrorsOf } from "@/application/schemas";
import type { EmailAccount } from "@/domain/email-account";
import { TextField } from "@/ui/components/form/Fields";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { FormSection, LoadingBlock, PageHeader } from "../components/AdminUi";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { TextAreaField } from "../components/FormControls";
import { FormFooter } from "../components/FormFooter";
import { CopyButton } from "../emails/CopyButton";
import { SecretField } from "../emails/SecretField";
import { useCopy } from "../emails/use-copy";
import { AccountSelect } from "../finance/AccountSelect";
import { useAdminQuery, useMutation } from "../hooks";
import { useToast } from "../toast";

interface EmailAccountFormValues {
  email: string;
  password: string;
  usedFor: string;
  recoveryEmail: string;
  recoveryPhone: string;
  accountId: string;
  notes: string;
}

const FIELD_ORDER = ["email", "password", "usedFor", "recoveryEmail", "recoveryPhone", "notes"] as const;

const EMPTY: EmailAccountFormValues = {
  email: "",
  password: "",
  usedFor: "",
  recoveryEmail: "",
  recoveryPhone: "",
  accountId: "",
  notes: "",
};

const fromEmailAccount = (item: EmailAccount): EmailAccountFormValues => ({
  email: item.email,
  password: item.password ?? "",
  usedFor: item.usedFor ?? "",
  recoveryEmail: item.recoveryEmail ?? "",
  recoveryPhone: item.recoveryPhone ?? "",
  accountId: item.accountId ?? "",
  notes: item.notes ?? "",
});

function validate(values: EmailAccountFormValues) {
  const result = emailAccountDataSchema.safeParse(values);
  return result.success ? { data: result.data, errors: {} } : { data: null, errors: fieldErrorsOf(result.error) };
}

function EmailAccountEditor({ emailAccount }: { emailAccount: EmailAccount | null }) {
  const navigate = useNavigate();
  const toast = useToast();
  const copy = useCopy();
  const [values, setValues] = useState<EmailAccountFormValues>(() => (emailAccount ? fromEmailAccount(emailAccount) : EMPTY));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const save = useMutation((deps, raw: EmailAccountFormValues) => saveEmailAccount(deps, emailAccount?.id ?? null, raw));
  const remove = useMutation(async (deps, id: string) => {
    await deleteEmailAccount(deps, id);
    return true;
  });

  const update = (patch: Partial<EmailAccountFormValues>) => {
    const next = { ...values, ...patch };
    setValues(next);
    if (submitted) setErrors(validate(next).errors);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    const formElement = event.currentTarget;
    const result = validate(values);
    setErrors(result.errors);
    if (!result.data) {
      const first = FIELD_ORDER.find((field) => result.errors[field]);
      if (first) formElement.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      toast.show("Revise os campos marcados em vermelho.", "error");
      return;
    }
    const saved = await save.run(values);
    if (!saved) {
      toast.show("Não foi possível salvar. Veja o aviso no formulário.", "error");
      return;
    }
    toast.show(`E-mail salvo: ${saved.email}.`);
    navigate("/admin/emails");
  };

  const onDelete = async () => {
    if (!emailAccount) return;
    const removed = await remove.run(emailAccount.id);
    if (!removed) return;
    toast.show("E-mail apagado.");
    navigate("/admin/emails");
  };

  return (
    <>
      <Link to="/admin/emails" className="inline-flex items-center gap-2 text-sm text-mist hover:text-white">
        <ArrowLeft aria-hidden className="size-4" /> Voltar
      </Link>
      <div className="mt-4">
        <PageHeader
          title={emailAccount ? "Editar e-mail" : "Novo e-mail"}
          description="A senha fica cifrada no banco. Só quem entra no painel consegue ver."
        />
      </div>

      <form noValidate onSubmit={onSubmit} aria-busy={save.pending} className="mt-6 grid max-w-3xl gap-6">
        <div className="space-y-5">
          <FormSection title="Acesso">
            <div className="flex items-end gap-1.5">
              <TextField
                label="E-mail"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                maxLength={254}
                placeholder="conta@gmail.com"
                className="min-w-0 flex-1"
                value={values.email}
                onChange={(event) => update({ email: event.target.value })}
                error={errors.email}
              />
              {values.email && !errors.email && (
                <CopyButton label="Copiar e-mail" className="mb-1.5" onCopy={() => void copy(values.email.trim(), "E-mail copiado.")} />
              )}
            </div>
            <SecretField
              label="Senha"
              name="password"
              value={values.password}
              onChange={(password) => update({ password })}
              error={errors.password}
              hint="Pode deixar em branco e anotar depois."
            />
            <TextField
              label="Onde usa"
              name="usedFor"
              autoComplete="off"
              maxLength={120}
              placeholder="TikTok @achadinhos, Instagram da loja…"
              value={values.usedFor}
              onChange={(event) => update({ usedFor: event.target.value })}
              error={errors.usedFor}
            />
            <AccountSelect
              value={values.accountId}
              onChange={(accountId) => update({ accountId })}
              hint="Quando a conta já está no estoque, ligue aqui para achar o e-mail na hora da entrega."
            />
          </FormSection>

          <FormSection title="Recuperação" description="O que a rede pede para recuperar o acesso.">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="E-mail de recuperação"
                name="recoveryEmail"
                type="email"
                inputMode="email"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                maxLength={254}
                value={values.recoveryEmail}
                onChange={(event) => update({ recoveryEmail: event.target.value })}
                error={errors.recoveryEmail}
              />
              <TextField
                label="Telefone de recuperação"
                name="recoveryPhone"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                placeholder="(11) 91234-5678"
                value={values.recoveryPhone}
                onChange={(event) => update({ recoveryPhone: event.target.value })}
                error={errors.recoveryPhone}
              />
            </div>
            <TextAreaField
              label="Anotações"
              name="notes"
              maxLength={2000}
              placeholder="Data de nascimento usada, códigos de backup, perguntas de segurança…"
              value={values.notes}
              onChange={(event) => update({ notes: event.target.value })}
              error={errors.notes}
            />
          </FormSection>
        </div>

        <FormFooter
          submitLabel={emailAccount ? "Salvar alterações" : "Salvar e-mail"}
          mobileSubmitLabel={emailAccount ? "Salvar" : "Salvar e-mail"}
          pending={save.pending}
          onCancel={() => navigate("/admin/emails")}
          onDelete={emailAccount ? () => setConfirmOpen(true) : undefined}
          deleteLabel="Apagar e-mail"
          errors={[Object.keys(errors).length > 0 ? "Revise os campos marcados em vermelho." : null, save.error?.message, remove.error?.message]}
        />
      </form>

      {emailAccount && (
        <ConfirmDialog
          open={confirmOpen}
          title="Apagar este e-mail?"
          description="A senha e os dados de recuperação somem do painel. Não dá para desfazer."
          confirmLabel="Apagar"
          pending={remove.pending}
          onConfirm={() => void onDelete()}
          onClose={() => setConfirmOpen(false)}
        />
      )}
    </>
  );
}

export default function EmailAccountEditorPage() {
  const { id } = useParams();
  const emailAccount = useAdminQuery((deps) => (id ? findEmailAccount(deps, id) : Promise.resolve(null)), id ?? "new");

  if (emailAccount.status === "loading") return <LoadingBlock />;
  if (emailAccount.status === "error") return <ErrorState message={emailAccount.error.message} onRetry={emailAccount.reload} />;
  if (id && !emailAccount.data) {
    return (
      <EmptyState
        title="E-mail não encontrado"
        description="Ele pode ter sido apagado."
        action={
          <Link to="/admin/emails" className="text-sm text-electric-soft underline-offset-4 hover:underline">
            Voltar para os e-mails
          </Link>
        }
      />
    );
  }
  return <EmailAccountEditor key={id ?? "new"} emailAccount={emailAccount.data} />;
}
