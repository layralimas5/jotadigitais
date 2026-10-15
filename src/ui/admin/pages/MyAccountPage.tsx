import { KeyRound, LogOut } from "lucide-react";
import { useState, type FormEvent } from "react";
import { container } from "@/app/container";
import { changePassword } from "@/application/admin-use-cases";
import { ValidationError, type ChangePasswordInput } from "@/application/schemas";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/form/Fields";
import { FormSection, InlineError, LoadingBlock, PageHeader } from "../components/AdminUi";
import { useMutation } from "../hooks";
import { useAdminSession } from "../session";
import { useToast } from "../toast";

const EMPTY: ChangePasswordInput = { password: "", confirmation: "" };

/** A senha só existe com o Supabase ligado; sem ele, o painel não tem senha para trocar. */
const CAN_CHANGE_PASSWORD = container.mode === "supabase";

function PasswordForm() {
  const toast = useToast();
  const [values, setValues] = useState<ChangePasswordInput>(EMPTY);
  const change = useMutation(async (deps, input: ChangePasswordInput) => {
    await changePassword(deps, input);
    return true;
  });
  const fieldErrors = change.error instanceof ValidationError ? change.error.fieldErrors : {};

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const done = await change.run(values);
    if (!done) return;
    setValues(EMPTY);
    toast.show("Senha alterada.");
  };

  return (
    <FormSection title="Trocar senha" description="Use pelo menos 8 caracteres. Você continua conectado neste aparelho.">
      <form noValidate onSubmit={onSubmit} aria-busy={change.pending} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Nova senha"
            name="password"
            type="password"
            autoComplete="new-password"
            value={values.password}
            onChange={(event) => setValues({ ...values, password: event.target.value })}
            error={fieldErrors.password}
          />
          <TextField
            label="Repita a nova senha"
            name="confirmation"
            type="password"
            autoComplete="new-password"
            value={values.confirmation}
            onChange={(event) => setValues({ ...values, confirmation: event.target.value })}
            error={fieldErrors.confirmation}
          />
        </div>
        {change.error && !(change.error instanceof ValidationError) && <InlineError message={change.error.message} />}
        <Button type="submit" disabled={change.pending}>
          <KeyRound aria-hidden className="size-4" />
          {change.pending ? "Salvando…" : "Salvar nova senha"}
        </Button>
      </form>
    </FormSection>
  );
}

export default function MyAccountPage() {
  const { state, signOut } = useAdminSession();
  if (state.status !== "signed-in") return <LoadingBlock />;

  return (
    <>
      <PageHeader title="Minha conta" description="Seu acesso ao sistema." />
      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start">
        <FormSection title="Acesso">
          <dl>
            <dt className="text-sm font-medium text-fog">Conectado como</dt>
            <dd className="mt-1 break-all text-white">{state.session.email}</dd>
          </dl>
          <Button variant="secondary" onClick={() => void signOut()}>
            <LogOut aria-hidden className="size-4" /> Sair do sistema
          </Button>
        </FormSection>
        {CAN_CHANGE_PASSWORD && <PasswordForm />}
      </div>
    </>
  );
}
