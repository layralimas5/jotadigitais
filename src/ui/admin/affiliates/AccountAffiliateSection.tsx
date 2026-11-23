import { useState } from "react";
import { accountAffiliateRuleSchema, getAccountAffiliateRule, saveAccountAffiliateRule } from "@/application/affiliate-use-cases";
import { fieldErrorsOf } from "@/application/schemas";
import { canUseStoreArea } from "@/domain/admin-user";
import { COMMISSION_KINDS, COMMISSION_KIND_LABEL, commissionCents, type AccountAffiliateRule, type CommissionKind } from "@/domain/affiliate";
import { formatBRL, formatCentsInput, parseMoneyToCents, type Cents } from "@/domain/money";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/form/Fields";
import { ErrorState } from "@/ui/components/StateViews";
import { useViewAccess } from "../admin-view";
import { FormSection, InlineError, LoadingBlock } from "../components/AdminUi";
import { SegmentedField, ToggleField } from "../components/FormControls";
import { useAdminQuery, useMutation } from "../hooks";
import { useToast } from "../toast";

interface RuleValues {
  enabled: boolean;
  custom: boolean;
  kind: CommissionKind;
  value: string;
}

const fromRule = (rule: AccountAffiliateRule): RuleValues => ({
  enabled: rule.enabled,
  custom: rule.commission !== null,
  kind: rule.commission?.kind ?? "percent",
  value: rule.commission ? (rule.commission.kind === "percent" ? String(rule.commission.value) : formatCentsInput(rule.commission.value)) : "",
});

const toRaw = (values: RuleValues) => ({
  enabled: values.enabled,
  commission: values.custom
    ? { kind: values.kind, value: values.kind === "percent" ? Number(values.value.replace(",", ".").trim()) : parseMoneyToCents(values.value) }
    : null,
});

/**
 * Salva sozinha, sem esperar o "Salvar" da ficha: a regra de afiliado vale na hora.
 * Não é um <form> próprio porque já vive dentro do form da conta.
 */
function RuleEditor({ accountId, price, rule, onSaved }: { accountId: string; price: Cents; rule: AccountAffiliateRule; onSaved: () => void }) {
  const toast = useToast();
  const [values, setValues] = useState<RuleValues>(() => fromRule(rule));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useMutation(async (deps, raw: unknown) => {
    await saveAccountAffiliateRule(deps, accountId, raw);
    return true;
  });
  const update = (patch: Partial<RuleValues>) => setValues((current) => ({ ...current, ...patch }));
  const raw = toRaw(values);
  const preview = values.custom && raw.commission && Number.isFinite(raw.commission.value) && raw.commission.value > 0 ? commissionCents(raw.commission, price) : null;

  const onSave = async () => {
    const result = accountAffiliateRuleSchema.safeParse(raw);
    setErrors(result.success ? {} : fieldErrorsOf(result.error));
    if (!result.success) return;
    const done = await save.run(raw);
    if (!done) return;
    toast.show(values.enabled ? "Regra de afiliado salva." : "Conta fora do programa de afiliados.");
    onSaved();
  };

  return (
    <>
      <ToggleField
        label="Liberada para afiliados"
        description="Desligada, a conta some da vitrine dos afiliados e não gera comissão."
        checked={values.enabled}
        onChange={(enabled) => update({ enabled })}
      />
      {values.enabled && (
        <ToggleField
          label="Comissão própria"
          description="Desligada, vale a comissão padrão do programa (aba Parceiros > Programa)."
          checked={values.custom}
          onChange={(custom) => update({ custom })}
        />
      )}
      {values.enabled && values.custom && (
        <>
          <SegmentedField<CommissionKind>
            legend="Tipo"
            name="affiliateKind"
            value={values.kind}
            options={COMMISSION_KINDS.map((kind) => ({ value: kind, label: COMMISSION_KIND_LABEL[kind] }))}
            onChange={(kind) => update({ kind, value: "" })}
          />
          <TextField
            label={values.kind === "percent" ? "Comissão (%)" : "Comissão (R$)"}
            name="affiliateValue"
            inputMode={values.kind === "percent" ? "numeric" : "decimal"}
            autoComplete="off"
            value={values.value}
            onChange={(event) => update({ value: event.target.value })}
            error={errors["commission.value"]}
            hint={preview !== null ? `No preço atual, o afiliado ganha ${formatBRL(preview)}.` : undefined}
          />
        </>
      )}
      {save.error && <InlineError message={save.error.message} />}
      <div className="flex justify-end">
        <Button variant="secondary" onClick={() => void onSave()} disabled={save.pending}>
          {save.pending ? "Salvando…" : "Salvar regra de afiliado"}
        </Button>
      </div>
    </>
  );
}

/** Na ficha de uma conta já salva: tirar do programa ou dar uma comissão diferente da padrão. */
export function AccountAffiliateSection({ accountId, price }: { accountId: string; price: Cents }) {
  const access = useViewAccess();
  const rule = useAdminQuery((deps) => getAccountAffiliateRule(deps, accountId), `affiliate-rule:${accountId}`);
  if (!access || !canUseStoreArea(access, "partners")) return null;

  return (
    <FormSection title="Afiliados" description="Quem divulga esta conta com link ou cupom ganha comissão quando o cliente paga.">
      {rule.status === "loading" && <LoadingBlock />}
      {rule.status === "error" && <ErrorState message={rule.error.message} onRetry={rule.reload} />}
      {rule.status === "success" && <RuleEditor key={JSON.stringify(rule.data)} accountId={accountId} price={price} rule={rule.data} onSaved={rule.reload} />}
    </FormSection>
  );
}
