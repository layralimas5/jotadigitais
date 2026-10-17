import { ArrowLeft, MailCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { requestPasswordReset } from "@/application/admin-use-cases";
import { ValidationError, type PasswordResetInput } from "@/application/schemas";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/form/Fields";
import { useMutation } from "../hooks";
import { InlineError } from "./AdminUi";

const RESET_REDIRECT_PATH = "/admin/minha-conta";

interface ForgotPasswordFormProps {
  initialEmail: string;
  onBack: () => void;
}

export function ForgotPasswordForm({ initialEmail, onBack }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState(initialEmail);
  const [sent, setSent] = useState(false);
  const reset = useMutation(async (deps, input: PasswordResetInput) => {
    await requestPasswordReset(deps, input, `${window.location.origin}${RESET_REDIRECT_PATH}`);
    return true;
  });
  const fieldErrors = reset.error instanceof ValidationError ? reset.error.fieldErrors : {};

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (await reset.run({ email })) setSent(true);
  };

  if (sent) {
    return (
      <div className="mt-6 space-y-5" role="status">
        <p className="flex gap-3 rounded-2xl border border-electric/30 bg-electric/[0.07] px-4 py-3 text-sm text-white">
          <MailCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-electric" />
          Se esse e-mail tiver acesso ao painel, o link para criar uma senha nova chega em instantes. Confira também o spam.
        </p>
        <Button type="button" variant="secondary" size="lg" className="w-full" onClick={onBack}>
          <ArrowLeft aria-hidden className="size-4" /> Voltar para o login
        </Button>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="mt-6 space-y-4" aria-busy={reset.pending}>
      <TextField
        label="E-mail"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={fieldErrors.email}
      />
      {reset.error && !(reset.error instanceof ValidationError) && <InlineError message={reset.error.message} />}
      <Button type="submit" size="lg" className="w-full" disabled={reset.pending}>
        {reset.pending ? "Enviando…" : "Enviar link"}
      </Button>
      <Button type="button" variant="ghost" className="w-full" onClick={onBack}>
        <ArrowLeft aria-hidden className="size-4" /> Voltar para o login
      </Button>
    </form>
  );
}
