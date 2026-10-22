import { KeyRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { changePassword } from "@/application/admin-use-cases";
import type { AdminSession } from "@/application/ports";
import { PASSWORD_RULE_HINT, ValidationError, type ChangePasswordInput } from "@/application/schemas";
import { WrongCurrentPasswordError } from "@/domain/errors";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/form/Fields";
import { FormSection, InlineError } from "../components/AdminUi";
import { useMutation } from "../hooks";
import { useToast } from "../toast";

const EMPTY: ChangePasswordInput = { currentPassword: "", password: "", confirmation: "" };

function fieldErrorsOf(error: Error | null): Record<string, string> {
  if (error instanceof ValidationError) return error.fieldErrors;
  if (error instanceof WrongCurrentPasswordError) return { currentPassword: error.message };
  return {};
}

const isFieldError = (error: Error | null): boolean => error instanceof ValidationError || error instanceof WrongCurrentPasswordError;

export function PasswordSection({ session }: { session: AdminSession }) {
  const toast = useToast();
  const [values, setValues] = useState<ChangePasswordInput>(EMPTY);
  const change = useMutation(async (deps, input: ChangePasswordInput) => {
    await changePassword(deps, input, session);
    return true;
  });
  const fieldErrors = fieldErrorsOf(change.error);
  const { recoveringPassword } = session;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const done = await change.run(values);
    if (!done) return;
    setValues(EMPTY);
    toast.show("Senha alterada.");
  };

  return (
    <FormSection
      title={recoveringPassword ? "Criar senha nova" : "Trocar senha"}
      description={`${PASSWORD_RULE_HINT} Você continua conectado neste aparelho.`}
    >
      <form id="senha" noValidate onSubmit={onSubmit} aria-busy={change.pending} className="space-y-4">
        {!recoveringPassword && (
          <TextField
            label="Senha atual"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            value={values.currentPassword}
            onChange={(event) => setValues({ ...values, currentPassword: event.target.value })}
            error={fieldErrors.currentPassword}
            className="sm:max-w-[calc(50%-0.5rem)]"
          />
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Nova senha"
            name="password"
            type="password"
            autoComplete="new-password"
            autoFocus={recoveringPassword}
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
        {change.error && !isFieldError(change.error) && <InlineError message={change.error.message} />}
        <Button type="submit" disabled={change.pending} className="max-sm:w-full">
          <KeyRound aria-hidden className="size-4" />
          {change.pending ? "Salvando…" : "Salvar nova senha"}
        </Button>
      </form>
    </FormSection>
  );
}
