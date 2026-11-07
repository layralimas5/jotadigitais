import { ArrowLeft, UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createAdminUser } from "@/application/admin-use-cases";
import { fieldErrorsOf, newAdminUserSchema, PASSWORD_RULE_HINT } from "@/application/schemas";
import type { AdminUserAccess, NewAdminUser } from "@/domain/admin-user";
import { TextField } from "@/ui/components/form/Fields";
import { PasswordField } from "@/ui/components/form/PasswordField";
import { FormSection, PageHeader } from "../components/AdminUi";
import { FormFooter } from "../components/FormFooter";
import { AccessFields } from "../users/AccessFields";
import { ExampleUsersNotice } from "../users/ExampleUsersNotice";
import { useMutation } from "../hooks";
import { firstNameOf } from "../lib/whatsapp";
import { useToast } from "../toast";

/** Começa como ajudante: o caso comum é alguém para ajudar em parte da loja. */
const EMPTY: NewAdminUser = { name: "", email: "", password: "", role: "helper", permissions: [] };

const FIELD_ORDER = ["name", "email", "password", "permissions"] as const;

function validate(values: NewAdminUser) {
  const result = newAdminUserSchema.safeParse(values);
  return result.success ? { data: result.data, errors: {} } : { data: null, errors: fieldErrorsOf(result.error) };
}

interface UserEditorPageProps {
  /** Para onde volta. Pela aba Acessos (TI), volta com a mensagem de acesso pronta para mandar. */
  backPath?: string;
}

const ACCESS_BACK_PATH = "/admin/acessos";

export default function UserEditorPage({ backPath = "/admin/usuarios" }: UserEditorPageProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const [values, setValues] = useState<NewAdminUser>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const create = useMutation(createAdminUser);

  const update = (patch: Partial<NewAdminUser>) => {
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
      const target = first === "permissions" ? '[name^="permission-"]' : `[name="${first}"]`;
      if (first) formElement.querySelector<HTMLElement>(target)?.focus();
      return;
    }
    const created = await create.run(values);
    if (!created) return;
    toast.show(`Acesso criado para ${firstNameOf(created.name ?? created.email)}.`);
    if (backPath === ACCESS_BACK_PATH) {
      navigate(backPath, { state: { createdAccess: { name: created.name, email: created.email, password: values.password } } });
      return;
    }
    navigate(backPath);
  };

  return (
    <>
      <Link to={backPath} className="inline-flex items-center gap-2 text-sm text-mist hover:text-white">
        <ArrowLeft aria-hidden className="size-4" /> Voltar
      </Link>
      <div className="mt-4">
        <PageHeader title="Novo usuário" description="A pessoa entra em /admin com este e-mail e a senha provisória." />
      </div>
      <ExampleUsersNotice className="mt-6 max-w-3xl" />

      <form noValidate onSubmit={onSubmit} aria-busy={create.pending} className="mt-6 grid max-w-3xl gap-6">
        <FormSection title="Acesso" description="Passe a senha por um canal seguro. Depois do primeiro acesso, a pessoa troca em Configurações.">
          <TextField
            label="Nome"
            name="name"
            autoComplete="off"
            maxLength={80}
            value={values.name}
            onChange={(event) => update({ name: event.target.value })}
            error={errors.name}
          />
          <TextField
            label="E-mail"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={values.email}
            onChange={(event) => update({ email: event.target.value })}
            error={errors.email}
          />
          <PasswordField
            label="Senha provisória"
            name="password"
            autoComplete="new-password"
            value={values.password}
            onChange={(event) => update({ password: event.target.value })}
            error={errors.password}
            hint={PASSWORD_RULE_HINT}
          />
        </FormSection>

        <AccessFields
          value={{ role: values.role, permissions: values.permissions }}
          onChange={(access: AdminUserAccess) => update(access)}
          error={errors.permissions}
        />

        <FormFooter
          submitLabel="Criar acesso"
          pendingLabel="Criando…"
          submitIcon={<UserPlus aria-hidden className="size-4" />}
          pending={create.pending}
          onCancel={() => navigate(backPath)}
          errors={[create.error?.message]}
        />
      </form>
    </>
  );
}
