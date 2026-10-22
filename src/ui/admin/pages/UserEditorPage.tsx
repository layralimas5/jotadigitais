import { ArrowLeft, UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createAdminUser } from "@/application/admin-use-cases";
import { fieldErrorsOf, newAdminUserSchema, PASSWORD_RULE_HINT } from "@/application/schemas";
import type { NewAdminUser } from "@/domain/admin-user";
import { TextField } from "@/ui/components/form/Fields";
import { FormSection, PageHeader } from "../components/AdminUi";
import { FormFooter } from "../components/FormFooter";
import { useMutation } from "../hooks";
import { firstNameOf } from "../lib/whatsapp";
import { useToast } from "../toast";

const EMPTY: NewAdminUser = { name: "", email: "", password: "" };

const FIELD_ORDER = ["name", "email", "password"] as const;

function validate(values: NewAdminUser) {
  const result = newAdminUserSchema.safeParse(values);
  return result.success ? { data: result.data, errors: {} } : { data: null, errors: fieldErrorsOf(result.error) };
}

export default function UserEditorPage() {
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
      if (first) formElement.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    const created = await create.run(values);
    if (!created) return;
    toast.show(`Acesso criado para ${firstNameOf(created.name ?? created.email)}.`);
    navigate("/admin/usuarios");
  };

  return (
    <>
      <Link to="/admin/usuarios" className="inline-flex items-center gap-2 text-sm text-mist hover:text-white">
        <ArrowLeft aria-hidden className="size-4" /> Voltar
      </Link>
      <div className="mt-4">
        <PageHeader title="Novo usuário" description="A pessoa entra em /admin com este e-mail e a senha provisória." />
      </div>

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
          <TextField
            label="Senha provisória"
            name="password"
            type="password"
            autoComplete="new-password"
            value={values.password}
            onChange={(event) => update({ password: event.target.value })}
            error={errors.password}
            hint={PASSWORD_RULE_HINT}
          />
        </FormSection>

        <FormFooter
          submitLabel="Criar acesso"
          pendingLabel="Criando…"
          submitIcon={<UserPlus aria-hidden className="size-4" />}
          pending={create.pending}
          onCancel={() => navigate("/admin/usuarios")}
          errors={[create.error?.message]}
        />
      </form>
    </>
  );
}
