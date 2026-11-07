import { Copy, KeyRound, MessageCircle, RefreshCw, Save } from "lucide-react";
import { useState, type FormEvent } from "react";
import { setAccessPassword, updateAccessProfile } from "@/application/access-use-cases";
import { accessPasswordSchema, accessProfileSchema, fieldErrorsOf, PASSWORD_RULE_HINT } from "@/application/schemas";
import { sameEmail, type AdminRole, type AdminUser } from "@/domain/admin-user";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/form/Fields";
import { PasswordField } from "@/ui/components/form/PasswordField";
import { FormSection } from "../components/AdminUi";
import { FormFooter } from "../components/FormFooter";
import { generatePassword } from "../emails/generate-password";
import { useCopy } from "../emails/use-copy";
import { useMutation } from "../hooks";
import { formatPhone } from "../lib/whatsapp";
import { useToast } from "../toast";
import type { AccessToSend } from "./SendAccessDialog";

/** O que a ficha precisa do usuário, venha da lista de Usuários (Jota) ou da de Acessos (TI). */
export type AccessProfileUser = Pick<AdminUser, "id" | "name" | "email" | "role" | "whatsapp">;

interface FormValues {
  name: string;
  email: string;
  whatsapp: string;
  /** Vazia: a senha continua a mesma. */
  password: string;
}

interface SaveInput {
  profile: { name: string; email: string; whatsapp: string | null };
  password: string | null;
}

const initialValues = (user: AccessProfileUser): FormValues => ({
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

const profileChanged = (user: AccessProfileUser, profile: SaveInput["profile"]) =>
  profile.name !== (user.name ?? "") || !sameEmail(profile.email, user.email) || (profile.whatsapp ?? null) !== (user.whatsapp ?? null);

interface AccessProfileFormProps {
  user: AccessProfileUser;
  /** Quem está editando: a desenvolvedora (TI) ou o admin. O servidor confere de novo. */
  viewerRole: AdminRole;
  /** Recarrega a lista depois de salvar; a chave da ficha remonta o formulário com os dados novos. */
  reload: () => void;
  onSend: (access: AccessToSend) => void;
  onCancel: () => void;
}

/** Nome, e-mail, WhatsApp e senha nova de quem entra no sistema. O que for salvo vale na hora para entrar. */
export function AccessProfileForm({ user, viewerRole, reload, onSend, onCancel }: AccessProfileFormProps) {
  const toast = useToast();
  const copy = useCopy();
  const [values, setValues] = useState<FormValues>(() => initialValues(user));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = useMutation(async (deps, input: SaveInput) => {
    if (profileChanged(user, input.profile)) await updateAccessProfile(deps, viewerRole, user, input.profile);
    if (input.password) await setAccessPassword(deps, viewerRole, user, { password: input.password });
    return input;
  });

  const update = (patch: Partial<FormValues>) => setValues((current) => ({ ...current, ...patch }));
  const emailChanged = !sameEmail(values.email.trim(), user.email);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { input, errors: found } = validate(values);
    setErrors(found);
    if (!input) return;
    if (!profileChanged(user, input.profile) && !input.password) {
      toast.show("Nada mudou.");
      return;
    }
    const saved = await save.run(input);
    if (!saved) return;
    toast.show(saved.password ? "Dados e senha salvos. Já valem para entrar." : "Dados salvos. Já valem para entrar.");
    // Mudou e-mail ou senha: a mensagem com o acesso novo já abre pronta para mandar.
    if (saved.password || emailChanged) {
      onSend({ name: saved.profile.name, email: saved.profile.email, whatsapp: saved.profile.whatsapp, password: saved.password });
    }
    update({ password: "" });
    reload();
  };

  return (
    <form noValidate onSubmit={onSubmit} aria-busy={save.pending} className="grid max-w-3xl gap-6">
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
        onCancel={onCancel}
        errors={[save.error?.message]}
        extraActions={
          <Button variant="secondary" onClick={() => onSend({ name: user.name, email: user.email, whatsapp: user.whatsapp, password: null })}>
            <MessageCircle aria-hidden className="size-4 text-[#25d366]" /> Mandar link de acesso
          </Button>
        }
      />
    </form>
  );
}
