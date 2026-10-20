import { ArrowLeft } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { deleteRevenue, findRevenue, saveRevenue } from "@/application/admin-use-cases";
import { fieldErrorsOf, revenueDataSchema } from "@/application/schemas";
import {
  EXPENSE_PAYMENT_METHODS,
  EXPENSE_PAYMENT_METHOD_LABEL,
  REVENUE_CATEGORIES,
  REVENUE_CATEGORY_LABEL,
  type Revenue,
  type RevenueCategory,
} from "@/domain/finance";
import { TextField } from "@/ui/components/form/Fields";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { FormSection, LoadingBlock, PageHeader } from "../components/AdminUi";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { SegmentedField, SelectField, TextAreaField } from "../components/FormControls";
import { FormFooter } from "../components/FormFooter";
import { AccountSelect } from "../finance/AccountSelect";
import { CustomerSelect } from "../finance/CustomerSelect";
import { formatCentsInput, parseMoneyToCents } from "../forms/account-form";
import { useAdminQuery, useMutation } from "../hooks";
import { localIsoDate } from "../lib/dates";
import { useToast } from "../toast";

interface RevenueFormValues {
  description: string;
  category: RevenueCategory;
  amount: string;
  date: string;
  paymentMethod: string;
  customerId: string;
  accountId: string;
  notes: string;
}

const FIELD_ORDER = ["description", "amount", "date", "notes"] as const;
const CATEGORY_OPTIONS = REVENUE_CATEGORIES.map((category) => ({ value: category, label: REVENUE_CATEGORY_LABEL[category] }));
const PAYMENT_OPTIONS = [
  { value: "", label: "Não informado" },
  ...EXPENSE_PAYMENT_METHODS.map((method) => ({ value: method, label: EXPENSE_PAYMENT_METHOD_LABEL[method] })),
];

const emptyForm = (customerId: string): RevenueFormValues => ({
  description: "",
  category: "account_sale",
  amount: "",
  date: localIsoDate(),
  paymentMethod: "pix",
  customerId,
  accountId: "",
  notes: "",
});

const fromRevenue = (revenue: Revenue): RevenueFormValues => ({
  description: revenue.description,
  category: revenue.category,
  amount: formatCentsInput(revenue.amount),
  date: revenue.date,
  paymentMethod: revenue.paymentMethod ?? "",
  customerId: revenue.customerId ?? "",
  accountId: revenue.accountId ?? "",
  notes: revenue.notes ?? "",
});

const toRaw = (values: RevenueFormValues) => ({ ...values, amount: parseMoneyToCents(values.amount) });

function validate(values: RevenueFormValues) {
  const result = revenueDataSchema.safeParse(toRaw(values));
  return result.success ? { data: result.data, errors: {} } : { data: null, errors: fieldErrorsOf(result.error) };
}

function BackLink() {
  return (
    <Link to="/admin/financeiro" className="inline-flex items-center gap-2 text-sm text-mist hover:text-white">
      <ArrowLeft aria-hidden className="size-4" /> Voltar para o financeiro
    </Link>
  );
}

function RevenueEditor({ revenue, prefillCustomerId }: { revenue: Revenue | null; prefillCustomerId: string }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [values, setValues] = useState<RevenueFormValues>(() => (revenue ? fromRevenue(revenue) : emptyForm(prefillCustomerId)));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const save = useMutation((deps, raw: ReturnType<typeof toRaw>) => saveRevenue(deps, revenue?.id ?? null, raw));
  const remove = useMutation(async (deps, id: string) => {
    await deleteRevenue(deps, id);
    return true;
  });

  const update = (patch: Partial<RevenueFormValues>) => {
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
    const saved = await save.run(toRaw(values));
    if (!saved) {
      toast.show("Não foi possível salvar. Veja o aviso no formulário.", "error");
      return;
    }
    toast.show(revenue ? "Receita atualizada." : "Receita lançada.");
    navigate("/admin/financeiro");
  };

  const onDelete = async () => {
    if (!revenue) return;
    const removed = await remove.run(revenue.id);
    if (!removed) return;
    toast.show("Receita apagada.");
    navigate("/admin/financeiro");
  };

  return (
    <>
      <BackLink />
      <div className="mt-4">
        <PageHeader
          title={revenue ? "Editar receita" : "Nova receita"}
          description="Dinheiro que entrou por fora do site. Pedidos pagos no site já entram sozinhos."
        />
      </div>

      <form noValidate onSubmit={onSubmit} aria-busy={save.pending} className="mt-6 grid max-w-3xl gap-6">
        <FormSection title="Receita">
          <SegmentedField<RevenueCategory>
            legend="Categoria"
            name="category"
            value={values.category}
            options={CATEGORY_OPTIONS}
            onChange={(category) => update({ category })}
          />
          <TextField
            label="Descrição"
            name="description"
            maxLength={120}
            placeholder="Ex.: venda da conta @achadinhos.dabia pelo WhatsApp"
            value={values.description}
            onChange={(event) => update({ description: event.target.value })}
            error={errors.description}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Valor (R$)"
              name="amount"
              inputMode="decimal"
              placeholder="450,00"
              value={values.amount}
              onChange={(event) => update({ amount: event.target.value })}
              error={errors.amount}
            />
            <TextField
              label="Data do recebimento"
              name="date"
              type="date"
              value={values.date}
              onChange={(event) => update({ date: event.target.value })}
              error={errors.date}
            />
          </div>
          <SelectField
            label="Forma de pagamento"
            name="paymentMethod"
            options={PAYMENT_OPTIONS}
            value={values.paymentMethod}
            onChange={(event) => update({ paymentMethod: event.target.value })}
            error={errors.paymentMethod}
          />
        </FormSection>

        <FormSection title="De quem e do quê" description="Opcional, mas ligar o cliente faz a venda aparecer na ficha dele.">
          <CustomerSelect value={values.customerId} onChange={(customerId) => update({ customerId })} />
          <AccountSelect
            value={values.accountId}
            hint={values.category === "account_sale" ? "Escolha a conta que foi vendida." : "Opcional."}
            onChange={(accountId) => update({ accountId })}
          />
          <TextAreaField
            label="Observações (opcional)"
            name="notes"
            maxLength={1000}
            placeholder="Combinado com o cliente, parcelas, comprovante…"
            value={values.notes}
            onChange={(event) => update({ notes: event.target.value })}
            error={errors.notes}
          />
        </FormSection>

        <FormFooter
          submitLabel={revenue ? "Salvar alterações" : "Lançar receita"}
          mobileSubmitLabel={revenue ? "Salvar" : "Lançar receita"}
          pending={save.pending}
          onCancel={() => navigate("/admin/financeiro")}
          onDelete={revenue ? () => setConfirmOpen(true) : undefined}
          deleteLabel="Apagar receita"
          errors={[Object.keys(errors).length > 0 ? "Revise os campos marcados em vermelho." : null, save.error?.message, remove.error?.message]}
        />
      </form>

      {revenue && (
        <ConfirmDialog
          open={confirmOpen}
          title="Apagar esta receita?"
          description="Ela sai do financeiro e da ficha do cliente, e o lucro do período é recalculado."
          confirmLabel="Apagar"
          pending={remove.pending}
          onConfirm={() => void onDelete()}
          onClose={() => setConfirmOpen(false)}
        />
      )}
    </>
  );
}

export default function RevenueEditorPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const revenue = useAdminQuery((deps) => (id ? findRevenue(deps, id) : Promise.resolve(null)), id ?? "new");

  if (revenue.status === "loading") return <LoadingBlock />;
  if (revenue.status === "error") return <ErrorState message={revenue.error.message} onRetry={revenue.reload} />;
  if (id && !revenue.data) {
    return <EmptyState title="Receita não encontrada" description="Ela pode ter sido apagada." action={<BackLink />} />;
  }
  return <RevenueEditor key={id ?? "new"} revenue={revenue.data} prefillCustomerId={params.get("cliente") ?? ""} />;
}
