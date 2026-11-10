import { Plus, Trash2 } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { deleteExpense, loadAccountBalance, logAccountExpense } from "@/application/admin-use-cases";
import { canUseStoreArea } from "@/domain/admin-user";
import type { Expense } from "@/domain/finance";
import { formatBRL, type Cents } from "@/domain/money";
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

function ExpenseRow({ day, amount, onRemove }: { day: string; amount: Cents; onRemove: () => void }) {
  return (
    <li className="flex items-center gap-3 py-3">
      <span className="flex-1 text-sm text-mist tabular-nums">{day}</span>
      <span className="text-sm font-semibold text-white tabular-nums">{formatBRL(amount)}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Apagar o gasto de ${formatBRL(amount)} (${day})`}
        className="grid size-8 shrink-0 place-items-center rounded-lg text-mist hover:bg-white/5 hover:text-[#ff7a7a] focus-visible:outline-2 focus-visible:outline-electric"
      >
        <Trash2 aria-hidden className="size-4" />
      </button>
    </li>
  );
}

/** Campo único de valor: Enter ou o botão lançam. Não é um form próprio porque já vive dentro do form da conta. */
function AmountEntry({ pending, error, onAdd }: { pending: boolean; error?: string; onAdd: (amount: Cents) => Promise<boolean> }) {
  const [text, setText] = useState("");
  const [invalid, setInvalid] = useState<string>();

  const add = async () => {
    const amount = parseMoneyToCents(text);
    if (Number.isNaN(amount) || amount <= 0) {
      setInvalid("Informe o valor. Ex.: 50 ou 1.250,00.");
      return;
    }
    setInvalid(undefined);
    if (await onAdd(amount)) setText("");
  };

  const onEnter = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" || !(event.target instanceof HTMLInputElement)) return;
    event.preventDefault();
    void add();
  };

  return (
    <div onKeyDown={onEnter} className="grid gap-3 rounded-2xl border border-line bg-ink/40 p-3 sm:grid-cols-[minmax(0,1fr)_10rem] sm:p-4">
      <TextField
        label="Valor gasto (R$)"
        name="expense.amount"
        inputMode="decimal"
        placeholder="50,00"
        value={text}
        error={invalid}
        onChange={(event) => setText(event.target.value)}
      />
      <div className="flex items-end">
        <Button type="button" className="w-full" onClick={() => void add()} disabled={pending}>
          <Plus aria-hidden className="size-4" /> {pending ? "Lançando…" : "Lançar gasto"}
        </Button>
      </div>
      {error && <p className="text-xs font-medium text-[#ff7a7a] sm:col-span-2">{error}</p>}
    </div>
  );
}

/** Conta já salva: cada valor vira na hora uma despesa do Financeiro ligada a ela. */
function SavedAccountExpenses({ accountId, handle }: { accountId: string; handle: string }) {
  const toast = useToast();
  const balance = useAdminQuery((deps) => loadAccountBalance(deps, accountId), `account-balance:${accountId}`);
  const [removing, setRemoving] = useState<Expense | null>(null);
  const create = useMutation((deps, amount: Cents) => logAccountExpense(deps, { id: accountId, handle }, amount, localIsoDate()));
  const remove = useMutation(async (deps, id: string) => {
    await deleteExpense(deps, id);
    return true;
  });

  const add = async (amount: Cents) => {
    const saved = await create.run(amount);
    if (!saved) return false;
    toast.show(`Gasto de ${formatBRL(saved.amount)} lançado. Já está no Financeiro.`);
    balance.reload();
    return true;
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

      <AmountEntry pending={create.pending} error={create.error?.message} onAdd={add} />

      {balance.status === "success" &&
        (balance.data.expenses.length === 0 ? (
          <p className="text-sm text-mist">Nenhum gasto lançado nesta conta ainda.</p>
        ) : (
          <ul aria-label="Gastos lançados" className="divide-y divide-line">
            {balance.data.expenses.map((expense) => (
              <ExpenseRow key={expense.id} day={shortDate.format(new Date(expense.date))} amount={expense.amount} onRemove={() => setRemoving(expense)} />
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

/** Conta nova: os valores ficam guardados no formulário e entram no Financeiro quando a conta é salva. */
function DraftAccountExpenses({ amounts, onChange }: { amounts: Cents[]; onChange: (amounts: Cents[]) => void }) {
  const total = amounts.reduce((sum, amount) => sum + amount, 0);
  const add = async (amount: Cents) => {
    onChange([...amounts, amount]);
    return true;
  };
  return (
    <>
      <dl className="grid grid-cols-3 gap-2 sm:gap-3">
        <BalanceTile label="Gasto" value={formatBRL(total)} />
        <BalanceTile label="Ganho" value={formatBRL(0)} />
        <BalanceTile label="Resultado" value={formatBRL(-total)} tone={total > 0 ? "bad" : "good"} />
      </dl>
      <AmountEntry pending={false} onAdd={add} />
      {amounts.length === 0 ? (
        <p className="text-sm text-mist">Nenhum gasto lançado ainda.</p>
      ) : (
        <>
          <ul aria-label="Gastos a lançar" className="divide-y divide-line">
            {amounts.map((amount, index) => (
              <ExpenseRow key={index} day="Hoje" amount={amount} onRemove={() => onChange(amounts.filter((_, at) => at !== index))} />
            ))}
          </ul>
          <p className="text-xs text-mist">Entram no Financeiro assim que você salvar a conta.</p>
        </>
      )}
    </>
  );
}

type AccountExpensesSectionProps =
  | { mode: "saved"; accountId: string; handle: string }
  | { mode: "draft"; amounts: Cents[]; onChange: (amounts: Cents[]) => void };

export function AccountExpensesSection(props: AccountExpensesSectionProps) {
  const access = useViewAccess();
  if (!access || !canUseStoreArea(access, "finance")) return null;
  return (
    <FormSection
      title="Gastos da conta"
      description="Coloque o valor que saiu por esta conta. Ele entra sozinho no Financeiro, em Despesas, com a data de hoje. O ganho soma as vendas pagas desta conta."
    >
      {props.mode === "saved" ? (
        <SavedAccountExpenses accountId={props.accountId} handle={props.handle} />
      ) : (
        <DraftAccountExpenses amounts={props.amounts} onChange={props.onChange} />
      )}
    </FormSection>
  );
}
