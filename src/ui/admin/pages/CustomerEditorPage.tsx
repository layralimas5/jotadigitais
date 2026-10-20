import { ArrowLeft } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { deleteCustomerRecord, findCustomerRecord, saveCustomerRecord } from "@/application/admin-use-cases";
import { customerRecordSchema, fieldErrorsOf } from "@/application/schemas";
import { maskDocumentInput } from "@/domain/brazil";
import { BRAZIL_STATES, recordKeyOf, type CustomerRecord } from "@/domain/customer";
import { LEAD_SOURCES, LEAD_SOURCE_LABEL } from "@/domain/lead";
import { PLATFORMS, PLATFORM_LABEL } from "@/domain/platform";
import { TextField } from "@/ui/components/form/Fields";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { FormSection, LoadingBlock, PageHeader } from "../components/AdminUi";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { SelectField, TextAreaField } from "../components/FormControls";
import { FormFooter } from "../components/FormFooter";
import { useAdminQuery, useMutation } from "../hooks";
import { firstNameOf } from "../lib/whatsapp";
import { useToast } from "../toast";

interface CustomerFormValues {
  name: string;
  document: string;
  birthDate: string;
  email: string;
  whatsapp: string;
  instagram: string;
  city: string;
  state: string;
  source: string;
  interest: string;
  notes: string;
}

const FIELD_ORDER = ["name", "document", "birthDate", "email", "whatsapp", "instagram", "city", "state", "source", "notes"] as const;

const STATE_OPTIONS = [{ value: "", label: "UF" }, ...BRAZIL_STATES.map((state) => ({ value: state, label: state }))];
const SOURCE_OPTIONS = [{ value: "", label: "Escolha" }, ...LEAD_SOURCES.map((source) => ({ value: source, label: LEAD_SOURCE_LABEL[source] }))];
const INTEREST_OPTIONS = [{ value: "", label: "Ainda não definiu" }, ...PLATFORMS.map((platform) => ({ value: platform, label: PLATFORM_LABEL[platform] }))];

const emptyForm = (): CustomerFormValues => ({
  name: "",
  document: "",
  birthDate: "",
  email: "",
  whatsapp: "",
  instagram: "",
  city: "",
  state: "",
  source: "",
  interest: "",
  notes: "",
});

// Cadastros antigos (antes da ficha completa) chegam sem alguns campos: ao salvar, a ficha precisa ser completada.
const fromRecord = (record: CustomerRecord): CustomerFormValues => ({
  name: record.name,
  document: record.document ? maskDocumentInput(record.document) : "",
  birthDate: record.birthDate ?? "",
  email: record.email ?? "",
  whatsapp: record.whatsapp ?? "",
  instagram: record.instagram ?? "",
  city: record.city ?? "",
  state: record.state ?? "",
  source: record.source ?? "",
  interest: record.interest ?? "",
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
          title={record ? "Editar ficha do cliente" : "Novo cliente"}
          description="Cliente que comprou por fora do site. A ficha é completa: só Instagram, interesse e anotações são opcionais."
        />
      </div>

      <form noValidate onSubmit={onSubmit} aria-busy={save.pending} className="mt-6 grid max-w-3xl gap-6">
        <div className="space-y-5">
          <FormSection title="Identificação">
            <TextField
              label="Nome completo"
              name="name"
              autoComplete="off"
              maxLength={80}
              value={values.name}
              onChange={(event) => update({ name: event.target.value })}
              error={errors.name}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="CPF ou CNPJ"
                name="document"
                inputMode="numeric"
                autoComplete="off"
                placeholder="000.000.000-00"
                maxLength={18}
                value={values.document}
                onChange={(event) => update({ document: maskDocumentInput(event.target.value) })}
                error={errors.document}
              />
              <TextField
                label="Data de nascimento"
                name="birthDate"
                type="date"
                value={values.birthDate}
                onChange={(event) => update({ birthDate: event.target.value })}
                error={errors.birthDate}
                className="[&_input]:[color-scheme:dark]"
              />
            </div>
          </FormSection>

          <FormSection title="Contato" description="Pedidos feitos no site com este e-mail entram no histórico do cliente.">
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
                label="Instagram (opcional)"
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
          </FormSection>

          <FormSection title="Localização">
            <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-4">
              <TextField
                label="Cidade"
                name="city"
                autoComplete="off"
                maxLength={60}
                placeholder="Ex.: Natal"
                value={values.city}
                onChange={(event) => update({ city: event.target.value })}
                error={errors.city}
              />
              <SelectField
                label="Estado"
                name="state"
                options={STATE_OPTIONS}
                value={values.state}
                onChange={(event) => update({ state: event.target.value })}
                error={errors.state}
              />
            </div>
          </FormSection>

          <FormSection title="Relacionamento" description="Ajuda a entender de onde vêm e o que procuram seus clientes.">
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Como chegou"
                name="source"
                options={SOURCE_OPTIONS}
                value={values.source}
                onChange={(event) => update({ source: event.target.value })}
                error={errors.source}
              />
              <SelectField
                label="Interesse (opcional)"
                name="interest"
                hint="Rede em que procura conta."
                options={INTEREST_OPTIONS}
                value={values.interest}
                onChange={(event) => update({ interest: event.target.value })}
                error={errors.interest}
              />
            </div>
            <TextAreaField
              label="Anotações (opcional)"
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
    ...emptyForm(),
    name: params.get("nome") ?? "",
    email: params.get("email") ?? "",
    whatsapp: params.get("whatsapp") ?? "",
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
