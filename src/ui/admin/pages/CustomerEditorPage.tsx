import { ArrowLeft } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { deleteCustomerRecord, findCustomerRecord, saveCustomerRecord } from "@/application/admin-use-cases";
import { customerRecordSchema, fieldErrorsOf } from "@/application/schemas";
import { recordKeyOf, type CustomerRecord } from "@/domain/customer";
import { TextField } from "@/ui/components/form/Fields";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { FormSection, LoadingBlock, PageHeader } from "../components/AdminUi";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { TextAreaField } from "../components/FormControls";
import { FormFooter } from "../components/FormFooter";
import { useAdminQuery, useMutation } from "../hooks";
import { firstNameOf } from "../lib/whatsapp";
import { useToast } from "../toast";

interface CustomerFormValues {
  name: string;
  email: string;
  whatsapp: string;
  instagram: string;
  notes: string;
}

const FIELD_ORDER = ["name", "email", "whatsapp", "instagram", "notes"] as const;

const fromRecord = (record: CustomerRecord): CustomerFormValues => ({
  name: record.name,
  email: record.email ?? "",
  whatsapp: record.whatsapp ?? "",
  instagram: record.instagram ?? "",
  notes: record.notes ?? "",
});

function validate(values: CustomerFormValues) {
  const result = customerRecordSchema.safeParse(values);
  return result.success ? { data: result.data, errors: {} } : { data: null, errors: fieldErrorsOf(result.error) };
}

const customerPath = (record: CustomerRecord) => `/admin/clientes/${encodeURIComponent(recordKeyOf(record))}`;

function CustomerEditor({ record, prefill }: { record: CustomerRecord | null; prefill: CustomerFormValues }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [values, setValues] = useState<CustomerFormValues>(() => (record ? fromRecord(record) : prefill));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const save = useMutation((deps, raw: CustomerFormValues) => saveCustomerRecord(deps, record?.id ?? null, raw));
  const remove = useMutation(async (deps, id: string) => {
    await deleteCustomerRecord(deps, id);
    return true;
  });
  const backTo = record ? customerPath(record) : "/admin/clientes";

  const update = (patch: Partial<CustomerFormValues>) => {
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
      toast.show("Revise os campos marcados em vermelho.", "error");
      return;
    }
    const saved = await save.run(values);
    if (!saved) {
      toast.show("Não foi possível salvar. Veja o aviso no formulário.", "error");
      return;
    }
    toast.show(`Cliente salvo: ${firstNameOf(saved.name)}.`);
    navigate(customerPath(saved));
  };

  const onDelete = async () => {
    if (!record) return;
    const removed = await remove.run(record.id);
    if (!removed) return;
    toast.show("Cadastro apagado. Os pedidos continuam em Pedidos.");
    navigate("/admin/clientes");
  };

  return (
    <>
      <Link to={backTo} className="inline-flex items-center gap-2 text-sm text-mist hover:text-white">
        <ArrowLeft aria-hidden className="size-4" /> Voltar
      </Link>
      <div className="mt-4">
        <PageHeader
          title={record ? "Editar cliente" : "Novo cliente"}
          description="Pedidos feitos no site com este e-mail entram no histórico do cliente."
        />
      </div>

      <form noValidate onSubmit={onSubmit} aria-busy={save.pending} className="mt-6 grid max-w-3xl gap-6">
        <div className="space-y-5">
          <FormSection title="Dados" description="Informe pelo menos um contato.">
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
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={values.email}
              onChange={(event) => update({ email: event.target.value })}
              error={errors.email}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="WhatsApp"
                name="whatsapp"
                type="tel"
                inputMode="tel"
                placeholder="(11) 91234-5678"
                value={values.whatsapp}
                onChange={(event) => update({ whatsapp: event.target.value })}
                error={errors.whatsapp}
              />
              <TextField
                label="Instagram"
                name="instagram"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="@perfil"
                maxLength={31}
                value={values.instagram}
                onChange={(event) => update({ instagram: event.target.value })}
                error={errors.instagram}
              />
            </div>
            <TextAreaField
              label="Anotações"
              name="notes"
              maxLength={2000}
              placeholder="Como comprou, preferências, combinados…"
              value={values.notes}
              onChange={(event) => update({ notes: event.target.value })}
              error={errors.notes}
            />
          </FormSection>
        </div>

        <FormFooter
          submitLabel={record ? "Salvar alterações" : "Cadastrar cliente"}
          mobileSubmitLabel={record ? "Salvar" : "Cadastrar cliente"}
          pending={save.pending}
          onCancel={() => navigate(backTo)}
          onDelete={record ? () => setConfirmOpen(true) : undefined}
          deleteLabel="Apagar cadastro"
          errors={[Object.keys(errors).length > 0 ? "Revise os campos marcados em vermelho." : null, save.error?.message, remove.error?.message]}
        />
      </form>

      {record && (
        <ConfirmDialog
          open={confirmOpen}
          title="Apagar este cadastro?"
          description="Os dados digitados aqui somem. Pedidos feitos no site continuam em Pedidos e o cliente segue aparecendo por eles."
          confirmLabel="Apagar"
          pending={remove.pending}
          onConfirm={() => void onDelete()}
          onClose={() => setConfirmOpen(false)}
        />
      )}
    </>
  );
}

export default function CustomerEditorPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const record = useAdminQuery((deps) => (id ? findCustomerRecord(deps, id) : Promise.resolve(null)), id ?? "new");
  const prefill: CustomerFormValues = {
    name: params.get("nome") ?? "",
    email: params.get("email") ?? "",
    whatsapp: params.get("whatsapp") ?? "",
    instagram: "",
    notes: "",
  };

  if (record.status === "loading") return <LoadingBlock />;
  if (record.status === "error") return <ErrorState message={record.error.message} onRetry={record.reload} />;
  if (id && !record.data) {
    return (
      <EmptyState
        title="Cadastro não encontrado"
        description="Ele pode ter sido apagado."
        action={
          <Link to="/admin/clientes" className="text-sm text-electric-soft underline-offset-4 hover:underline">
            Voltar para os clientes
          </Link>
        }
      />
    );
  }
  return <CustomerEditor key={id ?? "new"} record={record.data} prefill={prefill} />;
}
