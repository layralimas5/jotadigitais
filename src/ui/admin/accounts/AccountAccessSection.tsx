import { Link } from "react-router-dom";
import { canUseStoreArea } from "@/domain/admin-user";
import type { DeliveryLogin } from "@/domain/delivery-login";
import { accountAccessSchema, fieldErrorsOf, profileLoginSchema } from "@/application/schemas";
import { TextField } from "@/ui/components/form/Fields";
import { FormSection } from "../components/AdminUi";
import { CopyButton } from "../emails/CopyButton";
import { SecretField } from "../emails/SecretField";
import { useCopy } from "../emails/use-copy";
import { useViewAccess } from "../admin-view";

export interface AccessFormValues {
  email: string;
  password: string;
  username: string;
  profilePassword: string;
}

export type AccessFormErrors = Partial<Record<keyof AccessFormValues, string>>;

export const accessFormOf = (login: DeliveryLogin | null): AccessFormValues => ({
  email: login?.email?.email ?? "",
  password: login?.email?.password ?? "",
  username: login?.profile?.username ?? "",
  profilePassword: login?.profile?.password ?? "",
});

export const sameEmailAccess = (a: AccessFormValues, b: AccessFormValues) =>
  a.email.trim().toLowerCase() === b.email.trim().toLowerCase() && a.password === b.password;

export const sameProfileLogin = (a: AccessFormValues, b: AccessFormValues) =>
  a.username.trim() === b.username.trim() && a.profilePassword === b.profilePassword;

export const emailAccessInputOf = (values: AccessFormValues) => ({ email: values.email, password: values.password });

export const profileLoginInputOf = (values: AccessFormValues) => ({ username: values.username, password: values.profilePassword });

/** Ordem dos campos na tela, para levar o foco ao primeiro com erro. */
export const ACCESS_FIELD_ORDER = ["email", "password", "username", "profilePassword"] as const;

export function validateAccess(values: AccessFormValues): AccessFormErrors {
  const email = accountAccessSchema.safeParse(emailAccessInputOf(values));
  const profile = profileLoginSchema.safeParse(profileLoginInputOf(values));
  const emailErrors = email.success ? {} : fieldErrorsOf(email.error);
  const profileErrors = profile.success ? {} : fieldErrorsOf(profile.error);
  return { email: emailErrors.email, password: emailErrors.password, username: profileErrors.username, profilePassword: profileErrors.password };
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

/**
 * Login da conta: o e-mail (salvo na aba E-mails, ligado a esta conta) e o usuário e a senha do perfil na rede.
 * Tudo vai para quem comprar, na mensagem de entrega do WhatsApp.
 */
export function AccountAccessSection({ values, errors, onChange }: AccountAccessSectionProps) {
  const copy = useCopy();
  const email = values.email.trim();
  const username = values.username.trim();
  return (
    <FormSection
      title="Acesso da conta"
      description="O que vai para quem comprar, na mensagem de entrega do WhatsApp. As senhas ficam guardadas cifradas."
    >
      <div className="flex items-end gap-1.5">
        <TextField
          label="E-mail da conta"
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
        label="Senha do e-mail"
        name="access.password"
        value={values.password}
        onChange={(password) => onChange({ ...values, password })}
        error={errors.password}
        hint="Pode deixar em branco e anotar depois."
      />
      <div className="flex items-end gap-1.5 border-t border-line pt-4">
        <TextField
          label="Usuário do perfil"
          name="access.username"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={100}
          placeholder="usuario.do.perfil"
          className="min-w-0 flex-1"
          value={values.username}
          onChange={(event) => onChange({ ...values, username: event.target.value })}
          error={errors.username}
        />
        {username && !errors.username && <CopyButton label="Copiar usuário" className="mb-1.5" onCopy={() => void copy(username, "Usuário copiado.")} />}
      </div>
      <SecretField
        label="Senha do perfil"
        name="access.profilePassword"
        value={values.profilePassword}
        onChange={(profilePassword) => onChange({ ...values, profilePassword })}
        error={errors.profilePassword}
        hint="A senha de entrar na rede. Pode deixar em branco e anotar depois."
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
