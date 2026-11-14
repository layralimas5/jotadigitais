import { useMemo } from "react";
import { Link } from "react-router-dom";
import { listEmailAccounts } from "@/application/admin-use-cases";
import { canUseStoreArea } from "@/domain/admin-user";
import type { DeliveryLogin } from "@/domain/delivery-login";
import { devicesOf } from "@/domain/email-account";
import { PLATFORM_LABEL, type Platform } from "@/domain/platform";
import { accountAccessSchema, fieldErrorsOf, profileLoginSchema } from "@/application/schemas";
import { TextField } from "@/ui/components/form/Fields";
import { FormSection } from "../components/AdminUi";
import { CopyButton } from "../emails/CopyButton";
import { DeviceField } from "../emails/DeviceField";
import { SecretField } from "../emails/SecretField";
import { useCopy } from "../emails/use-copy";
import { useViewAccess } from "../admin-view";
import { useAdminQuery } from "../hooks";

export interface AccessFormValues {
  email: string;
  password: string;
  /** Aparelho em que o e-mail está logado (vai junto para a aba E-mails). */
  device: string;
  username: string;
  profilePassword: string;
}

export type AccessFormErrors = Partial<Record<keyof AccessFormValues, string>>;

export const accessFormOf = (login: DeliveryLogin | null): AccessFormValues => ({
  email: login?.email?.email ?? "",
  password: login?.email?.password ?? "",
  device: login?.email?.device ?? "",
  username: login?.profile?.username ?? "",
  profilePassword: login?.profile?.password ?? "",
});

export const sameEmailAccess = (a: AccessFormValues, b: AccessFormValues) =>
  a.email.trim().toLowerCase() === b.email.trim().toLowerCase() && a.password === b.password && a.device.trim() === b.device.trim();

export const sameProfileLogin = (a: AccessFormValues, b: AccessFormValues) =>
  a.username.trim() === b.username.trim() && a.profilePassword === b.profilePassword;

export const emailAccessInputOf = (values: AccessFormValues) => ({ email: values.email, password: values.password, device: values.device });

export const profileLoginInputOf = (values: AccessFormValues) => ({ username: values.username, password: values.profilePassword });

/** Ordem dos campos na tela, para levar o foco ao primeiro com erro. */
export const ACCESS_FIELD_ORDER = ["email", "password", "device", "username", "profilePassword"] as const;

export function validateAccess(values: AccessFormValues): AccessFormErrors {
  const email = accountAccessSchema.safeParse(emailAccessInputOf(values));
  const profile = profileLoginSchema.safeParse(profileLoginInputOf(values));
  const emailErrors = email.success ? {} : fieldErrorsOf(email.error);
  const profileErrors = profile.success ? {} : fieldErrorsOf(profile.error);
  return {
    email: emailErrors.email,
    password: emailErrors.password,
    device: emailErrors.device,
    username: profileErrors.username,
    profilePassword: profileErrors.password,
  };
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
  platform: Platform;
}

/** Título de cada bloco: deixa claro qual login é do e-mail e qual é da rede. */
function AccessGroupTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <p className="mt-0.5 text-xs text-mist">{hint}</p>
    </div>
  );
}

/**
 * Login da conta: o e-mail (salvo na aba E-mails, ligado a esta conta) e o usuário e a senha do perfil na rede.
 * Tudo vai para quem comprar, na mensagem de entrega do WhatsApp.
 */
export function AccountAccessSection({ values, errors, onChange, platform }: AccountAccessSectionProps) {
  const network = PLATFORM_LABEL[platform];
  const copy = useCopy();
  const email = values.email.trim();
  const username = values.username.trim();
  const savedEmails = useAdminQuery(listEmailAccounts, "admin-email-accounts");
  const usedDevices = useMemo(() => devicesOf(savedEmails.status === "success" ? savedEmails.data : []), [savedEmails]);
  return (
    <FormSection
      title="Acesso da conta"
      description="O que vai para quem comprar, na mensagem de entrega do WhatsApp. As senhas ficam guardadas cifradas."
    >
      <AccessGroupTitle title="1. Login do e-mail" hint="O e-mail ligado à conta e a senha para entrar nele." />
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
      <DeviceField name="access.device" value={values.device} onChange={(device) => onChange({ ...values, device })} used={usedDevices} error={errors.device} />
      <div className="border-t border-line pt-4">
        <AccessGroupTitle title={`2. Login do perfil no ${network}`} hint={`O usuário e a senha para entrar no ${network}.`} />
      </div>
      <div className="flex items-end gap-1.5">
        <TextField
          label={`Usuário do perfil no ${network}`}
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
        label={`Senha do perfil no ${network}`}
        name="access.profilePassword"
        value={values.profilePassword}
        onChange={(profilePassword) => onChange({ ...values, profilePassword })}
        error={errors.profilePassword}
        hint="Não é a senha do e-mail. Pode deixar em branco e anotar depois."
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
