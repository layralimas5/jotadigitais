import { ArrowLeft } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { deleteExpense, findExpense, saveExpense } from "@/application/admin-use-cases";
import { expenseDataSchema, fieldErrorsOf } from "@/application/schemas";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABEL,
  EXPENSE_PAYMENT_METHODS,
  EXPENSE_PAYMENT_METHOD_LABEL,
  type Expense,
  type ExpenseCategory,
} from "@/domain/finance";
import { TextField } from "@/ui/components/form/Fields";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { FormSection, LoadingBlock, PageHeader } from "../components/AdminUi";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { SegmentedField, SelectField, TextAreaField } from "../components/FormControls";
import { FormFooter } from "../components/FormFooter";
import { AccountSelect } from "../finance/AccountSelect";
import { formatCentsInput, parseMoneyToCents } from "../forms/account-form";
import { useAdminQuery, useMutation } from "../hooks";
import { localIsoDate } from "../lib/dates";
import { useToast } from "../toast";

interface ExpenseFormValues {
  description: string;
  category: ExpenseCategory;
  amount: string;
  date: string;
  supplier: string;
  paymentMethod: string;
  accountId: string;
  notes: string;
}

const FIELD_ORDER = ["description", "amount", "date", "supplier", "notes"] as const;
const CATEGORY_OPTIONS = EXPENSE_CATEGORIES.map((category) => ({ value: category, label: EXPENSE_CATEGORY_LABEL[category] }));
const PAYMENT_OPTIONS = [
  { value: "", label: "Não informado" },
  ...EXPENSE_PAYMENT_METHODS.map((method) => ({ value: method, label: EXPENSE_PAYMENT_METHOD_LABEL[method] })),
];

const emptyForm = (): ExpenseFormValues => ({
  description: "",
  category: "account_purchase",
  amount: "",
  date: localIsoDate(),
  supplier: "",
  paymentMethod: "",
  accountId: "",
  notes: "",
});

// Despesas antigas (antes de fornecedor, pagamento e conta ligada) chegam sem esses campos.
const fromExpense = (expense: Expense): ExpenseFormValues => ({
  description: expense.description,
  category: expense.category,
  amount: formatCentsInput(expense.amount),
  date: expense.date,
  supplier: expense.supplier ?? "",
  paymentMethod: expense.paymentMethod ?? "",
  accountId: expense.accountId ?? "",
  notes: expense.notes ?? "",
});

const toRaw = (values: ExpenseFormValues) => ({ ...values, amount: parseMoneyToCents(values.amount) });

function validate(values: ExpenseFormValues) {
  const result = expenseDataSchema.safeParse(toRaw(values));
  return result.success ? { data: result.data, errors: {} } : { data: null, errors: fieldErrorsOf(result.error) };
}

function BackLink() {
  return (
    <Link to="/admin/financeiro" className="inline-flex items-center gap-2 text-sm text-mist hover:text-white">
      <ArrowLeft aria-hidden className="size-4" /> Voltar para o financeiro
    </Link>
  );
}

function ExpenseEditor({ expense }: { expense: Expense | null }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [values, setValues] = useState<ExpenseFormValues>(() => (expense ? fromExpense(expense) : emptyForm()));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const save = useMutation((deps, raw: ReturnType<typeof toRaw>) => saveExpense(deps, expense?.id ?? null, raw));
  const remove = useMutation(async (deps, id: string) => {
    await deleteExpense(deps, id);
    return true;
  });

  const update = (patch: Partial<ExpenseFormValues>) => {
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
    toast.show(expense ? "Despesa atualizada." : "Despesa lançada.");
    navigate("/admin/financeiro");
  };

  const onDelete = async () => {
    if (!expense) return;
    const removed = await remove.run(expense.id);
    if (!removed) return;
    toast.show("Despesa apagada.");
    navigate("/admin/financeiro");
  };

  return (
    <>
      <BackLink />
      <div className="mt-4">
        <PageHeader title={expense ? "Editar despesa" : "Nova despesa"} description="Entra no financeiro na data escolhida." />
      </div>

      <form noValidate onSubmit={onSubmit} aria-busy={save.pending} className="mt-6 grid max-w-3xl gap-6">
        <FormSection title="Despesa">
          <SegmentedField<ExpenseCategory>
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
            placeholder="Ex.: compra da conta @achadinhos.dabia"
            value={values.description}
            onChange={(event) => update({ description: event.target.value })}
            error={errors.description}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Valor (R$)"
              name="amount"
              inputMode="decimal"
              placeholder="150,00"
              value={values.amount}
              onChange={(event) => update({ amount: event.target.value })}
              error={errors.amount}
            />
            <TextField
              label="Data"
              name="date"
              type="date"
              value={values.date}
              onChange={(event) => update({ date: event.target.value })}
              error={errors.date}
            />
          </div>
        </FormSection>

        <FormSection title="Pagamento">
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Forma de pagamento"
              name="paymentMethod"
              options={PAYMENT_OPTIONS}
              value={values.paymentMethod}
              onChange={(event) => update({ paymentMethod: event.target.value })}
              error={errors.paymentMethod}
            />
            <TextField
              label="Pago a (opcional)"
              name="supplier"
              autoComplete="off"
              maxLength={80}
              placeholder="Ex.: vendedor, Meta Ads, Canva"
              value={values.supplier}
              onChange={(event) => update({ supplier: event.target.value })}
              error={errors.supplier}
            />
          </div>
        </FormSection>

        <FormSection title="Detalhes">
          <AccountSelect
            value={values.accountId}
            hint={
              values.category === "account_purchase"
                ? "Escolha a conta que foi comprada."
                : "Opcional. Use quando o gasto for de uma conta específica."
            }
            onChange={(accountId) => update({ accountId })}
          />
          <TextAreaField
            label="Observações (opcional)"
            name="notes"
            maxLength={1000}
            placeholder="Número do pedido, combinado com o vendedor, parcelas…"
            value={values.notes}
            onChange={(event) => update({ notes: event.target.value })}
            error={errors.notes}
          />
        </FormSection>

        <FormFooter
          submitLabel={expense ? "Salvar alterações" : "Lançar despesa"}
          mobileSubmitLabel={expense ? "Salvar" : "Lançar despesa"}
          pending={save.pending}
          onCancel={() => navigate("/admin/financeiro")}
          onDelete={expense ? () => setConfirmOpen(true) : undefined}
          deleteLabel="Apagar despesa"
          errors={[Object.keys(errors).length > 0 ? "Revise os campos marcados em vermelho." : null, save.error?.message, remove.error?.message]}
        />
      </form>

      {expense && (
        <ConfirmDialog
          open={confirmOpen}
          title="Apagar esta despesa?"
          description="Ela sai do financeiro e o lucro do período é recalculado."
          confirmLabel="Apagar"
          pending={remove.pending}
          onConfirm={() => void onDelete()}
          onClose={() => setConfirmOpen(false)}
        />
      )}
    </>
  );
}

export default function ExpenseEditorPage() {
  const { id } = useParams();
  const expense = useAdminQuery((deps) => (id ? findExpense(deps, id) : Promise.resolve(null)), id ?? "new");

  if (expense.status === "loading") return <LoadingBlock />;
  if (expense.status === "error") return <ErrorState message={expense.error.message} onRetry={expense.reload} />;
  if (id && !expense.data) {
    return <EmptyState title="Despesa não encontrada" description="Ela pode ter sido apagada." action={<BackLink />} />;
  }
  return <ExpenseEditor key={id ?? "new"} expense={expense.data} />;
}
