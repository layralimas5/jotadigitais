import { useState, type FormEvent } from "react";
import { getSoldTotal, setSoldTotal } from "@/application/admin-use-cases";
import { MAX_SOLD_TOTAL, soldTotalSchema } from "@/application/schemas";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/form/Fields";
import { ErrorState } from "@/ui/components/StateViews";
import { FormSection, InlineError, LoadingBlock } from "../components/AdminUi";
import { useAdminQuery, useMutation } from "../hooks";
import { useToast } from "../toast";

const formatCount = (value: number) => value.toLocaleString("pt-BR");

function SoldCounterForm({ total, onSaved }: { total: number; onSaved: () => void }) {
  const toast = useToast();
  const [value, setValue] = useState(String(total));
  const [error, setError] = useState<string | undefined>();
  const save = useMutation(setSoldTotal);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = soldTotalSchema.safeParse(Number(value.replace(/\D/g, "") || Number.NaN));
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Número inválido.");
      return;
    }
    setError(undefined);
    const saved = await save.run(parsed.data);
    if (saved === undefined) return;
    setValue(String(saved));
    onSaved();
    toast.show(`Contador atualizado: ${formatCount(saved)} contas vendidas.`);
  };

  return (
    <form noValidate onSubmit={onSubmit} aria-busy={save.pending} className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <TextField
        label="Contas vendidas até agora"
        name="soldTotal"
        inputMode="numeric"
        className="sm:max-w-56"
        maxLength={String(MAX_SOLD_TOTAL).length + 2}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        error={error}
        hint={`Hoje a home mostra +${formatCount(total)}.`}
      />
      <Button type="submit" variant="secondary" disabled={save.pending} className="sm:mt-7">
        {save.pending ? "Salvando…" : "Salvar total"}
      </Button>
      {save.error && <InlineError message={save.error.message} />}
    </form>
  );
}

/** Site > Contato: o número "+3.043 contas vendidas" da home. As vendas pagas no site somam sozinhas. */
export function SoldCounterSettings() {
  const sold = useAdminQuery(getSoldTotal, "sold-total");
  return (
    <FormSection
      title="Contas vendidas"
      description="Aparece no topo da home. Cada conta paga no site soma 1 sozinha; corrija aqui só se quiser trocar o total."
    >
      {sold.status === "loading" && <LoadingBlock />}
      {sold.status === "error" && <ErrorState message={sold.error.message} onRetry={sold.reload} />}
      {sold.status === "success" && <SoldCounterForm key={sold.data} total={sold.data} onSaved={sold.reload} />}
    </FormSection>
  );
}
