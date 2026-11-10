import { Plus, Trash2 } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { deleteExpense, loadAccountBalance, saveExpense } from "@/application/admin-use-cases";
import { canUseStoreArea } from "@/domain/admin-user";
import { ACCOUNT_EXPENSE_CATEGORY, type Expense } from "@/domain/finance";
import { formatBRL } from "@/domain/money";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/form/Fields";
import { ErrorState } from "@/ui/components/StateViews";
import { cn } from "@/ui/lib/cn";
import { useViewAccess } from "../admin-view";
import { FormSection, LoadingBlock } from "../components/AdminUi";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { parseMoneyToCents } from "../forms/account-form";
import { useAdminQuery, useMutation } from "../hooks";
import { localIsoDate } from "../lib/dates";
import { useToast } from "../toast";

const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" });

function BalanceTile({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-ink/50 px-3 py-3 sm:px-4">
      <dt className="text-xs text-mist">{label}</dt>
      <dd className={cn("mt-0.5 font-display text-sm font-semibold whitespace-nowrap sm:text-lg tabular-nums text-white", tone === "good" && "text-emerald-300", tone === "bad" && "text-[#ff7a7a]")}>
        {value}
      </dd>
    </div>
  );
}

function ExpenseRow({ expense, onRemove }: { expense: Expense; onRemove: () => void }) {
  const day = shortDate.format(new Date(expense.date));
  return (
    <li className="flex items-center gap-3 py-3">
      <span className="flex-1 text-sm text-mist tabular-nums">{day}</span>
      <span className="text-sm font-semibold text-white tabular-nums">{formatBRL(expense.amount)}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Apagar o gasto de ${formatBRL(expense.amount)} do dia ${day}`}
        className="grid size-8 shrink-0 place-items-center rounded-lg text-mist hover:bg-white/5 hover:text-[#ff7a7a] focus-visible:outline-2 focus-visible:outline-electric"
      >
        <Trash2 aria-hidden className="size-4" />
      </button>
    </li>
  );
}

/** Gastos lançados direto na ficha: só o valor; cada um vira uma despesa do Financeiro ligada à conta. */
function AccountExpenses({ accountId, handle }: { accountId: string; handle: string }) {
  const toast = useToast();
  const balance = useAdminQuery((deps) => loadAccountBalance(deps, accountId), `account-balance:${accountId}`);
  const [amountText, setAmountText] = useState("");
  const [amountError, setAmountError] = useState<string>();
  const [removing, setRemoving] = useState<Expense | null>(null);
  const create = useMutation((deps, raw: unknown) => saveExpense(deps, null, raw));
  const remove = useMutation(async (deps, id: string) => {
    await deleteExpense(deps, id);
    return true;
  });

  const submit = async () => {
    const amount = parseMoneyToCents(amountText);
    if (Number.isNaN(amount) || amount <= 0) {
      setAmountError("Informe o valor. Ex.: 50 ou 1.250,00.");
      return;
    }
    setAmountError(undefined);
    const saved = await create.run({
      description: `Gasto da conta ${handle}`,
      category: ACCOUNT_EXPENSE_CATEGORY,
      amount,
      date: localIsoDate(new Date()),
      supplier: null,
      paymentMethod: null,
      accountId,
      notes: null,
    });
    if (!saved) return;
    toast.show(`Gasto de ${formatBRL(saved.amount)} lançado. Já está no Financeiro.`);
    setAmountText("");
    balance.reload();
  };

  const onEnter = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" || !(event.target instanceof HTMLInputElement)) return;
    event.preventDefault();
    void submit();
  };

  const confirmRemove = async () => {
    if (!removing) return;
    const done = await remove.run(removing.id);
    if (!done) return;
    toast.show("Gasto apagado. Saiu também do Financeiro.");
    setRemoving(null);
    balance.reload();
  };

  return (
    <>
      {balance.status === "loading" && <LoadingBlock />}
      {balance.status === "error" && <ErrorState message={balance.error.message} onRetry={balance.reload} />}
      {balance.status === "success" && (
        <dl className="grid grid-cols-3 gap-2 sm:gap-3">
          <BalanceTile label="Gasto" value={formatBRL(balance.data.spent)} />
          <BalanceTile label="Ganho" value={formatBRL(balance.data.earned)} />
          <BalanceTile
            label="Resultado"
            value={formatBRL(balance.data.earned - balance.data.spent)}
            tone={balance.data.earned - balance.data.spent >= 0 ? "good" : "bad"}
          />
        </dl>
      )}

      <div
        onKeyDown={onEnter}
        className="grid gap-3 rounded-2xl border border-line bg-ink/40 p-3 sm:grid-cols-[minmax(0,1fr)_10rem] sm:p-4"
      >
        <TextField
          label="Valor gasto (R$)"
          name="expense.amount"
          inputMode="decimal"
          placeholder="50,00"
          value={amountText}
          error={amountError}
          onChange={(event) => setAmountText(event.target.value)}
        />
        <div className="flex items-end">
          <Button type="button" className="w-full" onClick={() => void submit()} disabled={create.pending}>
            <Plus aria-hidden className="size-4" /> {create.pending ? "Lançando…" : "Lançar gasto"}
          </Button>
        </div>
        {create.error && <p className="text-xs font-medium text-[#ff7a7a] sm:col-span-2">{create.error.message}</p>}
      </div>

      {balance.status === "success" &&
        (balance.data.expenses.length === 0 ? (
          <p className="text-sm text-mist">Nenhum gasto lançado nesta conta ainda.</p>
        ) : (
          <ul aria-label="Gastos lançados" className="divide-y divide-line">
            {balance.data.expenses.map((expense) => (
              <ExpenseRow key={expense.id} expense={expense} onRemove={() => setRemoving(expense)} />
            ))}
          </ul>
        ))}

      <ConfirmDialog
        open={removing !== null}
        title="Apagar este gasto?"
        description={removing ? `O gasto de ${formatBRL(removing.amount)} sai da conta e do Financeiro.` : ""}
        confirmLabel="Apagar"
        pending={remove.pending}
        onConfirm={() => void confirmRemove()}
        onClose={() => setRemoving(null)}
      />
    </>
  );
}

interface AccountExpensesSectionProps {
  /** Nulo enquanto a conta ainda não foi salva. */
  accountId: string | null;
  handle: string;
}

export function AccountExpensesSection({ accountId, handle }: AccountExpensesSectionProps) {
  const access = useViewAccess();
  if (!access || !canUseStoreArea(access, "finance")) return null;
  return (
    <FormSection
      title="Gastos da conta"
      description="Coloque o valor que saiu por esta conta. Ele entra sozinho no Financeiro, em Despesas, com a data de hoje. O ganho soma as vendas pagas desta conta."
    >
      {accountId ? <AccountExpenses accountId={accountId} handle={handle} /> : <p className="text-sm text-mist">Cadastre a conta primeiro; depois os gastos dela são lançados aqui.</p>}
    </FormSection>
  );
}
