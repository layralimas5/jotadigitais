import { ArrowLeft } from "lucide-react";
import { useState, type FormEvent } from "react";
import { verifyMfaCode } from "@/application/admin-use-cases";
import { ValidationError } from "@/application/schemas";
import { InvalidMfaCodeError } from "@/domain/errors";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/form/Fields";
import { useMutation } from "../hooks";
import { useAdminSession } from "../session";
import { InlineError } from "./AdminUi";

/** Erro que pertence ao campo do código (formato ou código errado); o resto aparece embaixo do formulário. */
export function mfaCodeErrorOf(error: Error | null): string | undefined {
  if (error instanceof ValidationError) return error.fieldErrors.code;
  if (error instanceof InvalidMfaCodeError) return error.message;
  return undefined;
}

interface MfaCodeFieldProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoFocus?: boolean;
}

export function MfaCodeField({ value, onChange, error, autoFocus }: MfaCodeFieldProps) {
  return (
    <TextField
      label="Código do app autenticador"
      name="code"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9 ]*"
      maxLength={7}
      autoFocus={autoFocus}
      hint="Os 6 números que aparecem agora no Google Authenticator (ou no app que você usa)."
      value={value}
      onChange={(event) => onChange(event.target.value)}
      error={error}
    />
  );
}

/** Segunda etapa do login: a senha já foi aceita, falta o código. */
export function MfaChallengeForm({ onVerified }: { onVerified: () => void }) {
  const { signOut, refresh } = useAdminSession();
  const [code, setCode] = useState("");
  const verify = useMutation(verifyMfaCode);
  const codeError = mfaCodeErrorOf(verify.error);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!(await verify.run({ code }))) return;
    await refresh();
    onVerified();
  };

  return (
    <form noValidate onSubmit={onSubmit} className="mt-6 space-y-4" aria-busy={verify.pending}>
      <MfaCodeField value={code} onChange={setCode} error={codeError} autoFocus />
      {verify.error && !codeError && <InlineError message={verify.error.message} />}
      <Button type="submit" size="lg" className="w-full" disabled={verify.pending}>
        {verify.pending ? "Conferindo…" : "Entrar"}
      </Button>
      <Button type="button" variant="secondary" size="lg" className="w-full" onClick={() => void signOut()}>
        <ArrowLeft aria-hidden className="size-4" /> Entrar com outra conta
      </Button>
    </form>
  );
}
