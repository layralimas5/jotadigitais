import { Link } from "react-router-dom";
import { canUseStoreArea } from "@/domain/admin-user";
import type { AccountAccess } from "@/domain/email-account";
import { accountAccessSchema, fieldErrorsOf } from "@/application/schemas";
import { TextField } from "@/ui/components/form/Fields";
import { FormSection } from "../components/AdminUi";
import { CopyButton } from "../emails/CopyButton";
import { SecretField } from "../emails/SecretField";
import { useCopy } from "../emails/use-copy";
import { useViewAccess } from "../admin-view";

export interface AccessFormValues {
  email: string;
  password: string;
}

export type AccessFormErrors = Partial<Record<keyof AccessFormValues, string>>;

export const accessFormOf = (access: AccountAccess | null): AccessFormValues => ({
  email: access?.email ?? "",
  password: access?.password ?? "",
});

export const sameAccess = (a: AccessFormValues, b: AccessFormValues) => a.email.trim().toLowerCase() === b.email.trim().toLowerCase() && a.password === b.password;

export function validateAccess(values: AccessFormValues): AccessFormErrors {
  const result = accountAccessSchema.safeParse(values);
  if (result.success) return {};
  const errors = fieldErrorsOf(result.error);
  return { email: errors.email, password: errors.password };
}

/** Só quem abre a aba E-mails (admin ou ajudante com essa área) vê e edita o login da conta. */
export function useCanEditAccess(): boolean {
  const access = useViewAccess();
  return access !== null && canUseStoreArea(access, "emails");
}

interface AccountAccessSectionProps {
  values: AccessFormValues;
  errors: AccessFormErrors;
  onChange: (values: AccessFormValues) => void;
}

/** E-mail e senha da conta. Salvos na aba E-mails, ligados a esta conta, e enviados a quem comprar. */
export function AccountAccessSection({ values, errors, onChange }: AccountAccessSectionProps) {
  const copy = useCopy();
  const email = values.email.trim();
  return (
    <FormSection
      title="Acesso da conta"
      description="O e-mail e a senha que vão para quem comprar, na mensagem de entrega do WhatsApp. Ficam guardados na aba E-mails, ligados a esta conta, com a senha cifrada."
    >
      <div className="flex items-end gap-1.5">
        <TextField
          label="E-mail de login"
          name="access.email"
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
          onChange={(event) => onChange({ ...values, email: event.target.value })}
          error={errors.email}
        />
        {email && !errors.email && <CopyButton label="Copiar e-mail" className="mb-1.5" onCopy={() => void copy(email, "E-mail copiado.")} />}
      </div>
      <SecretField
        label="Senha"
        name="access.password"
        value={values.password}
        onChange={(password) => onChange({ ...values, password })}
        error={errors.password}
        hint="Pode deixar em branco e anotar depois."
      />
      <p className="text-xs text-mist">
        Recuperação e anotações ficam na{" "}
        <Link to="/admin/emails" className="text-electric-soft underline-offset-4 hover:underline">
          aba E-mails
        </Link>
        .
      </p>
    </FormSection>
  );
}
