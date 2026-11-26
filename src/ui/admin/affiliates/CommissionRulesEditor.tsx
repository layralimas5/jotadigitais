import { Pencil, Plus, Trash2 } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { commissionRuleDataSchema, removeCommissionRule, saveCommissionRule } from "@/application/affiliate-use-cases";
import { fieldErrorsOf } from "@/application/schemas";
import { COMMISSION_KINDS, COMMISSION_KIND_LABEL, MAX_COMMISSION_PERCENT, type CommissionKind } from "@/domain/affiliate";
import {
  COMMISSION_RULE_PRECEDENCE,
  commissionRuleSummary,
  type AffiliateCommissionRule,
  type CommissionRuleData,
  type CommissionRuleOwner,
} from "@/domain/affiliate-commission-rules";
import { formatBRL, formatCentsInput, parseMoneyToCents } from "@/domain/money";
import { STOCK_CATEGORIES, STOCK_CATEGORY_LABEL, type StockCategory } from "@/domain/stock";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/form/Fields";
import { FormSection, InlineError } from "../components/AdminUi";
import { SegmentedField, SelectField } from "../components/FormControls";
import { useMutation } from "../hooks";
import { useToast } from "../toast";

const ANY_CATEGORY = "any";

interface RuleFormValues {
  category: StockCategory | typeof ANY_CATEGORY;
  minFollowers: string;
  kind: CommissionKind;
  value: string;
}

const EMPTY_RULE: RuleFormValues = { category: ANY_CATEGORY, minFollowers: "", kind: "fixed", value: "" };

const valuesOf = (rule: CommissionRuleData): RuleFormValues => ({
  category: rule.category ?? ANY_CATEGORY,
  minFollowers: rule.minFollowers === null ? "" : String(rule.minFollowers),
  kind: rule.commission.kind,
  value: rule.commission.kind === "percent" ? String(rule.commission.value) : formatCentsInput(rule.commission.value),
});

const rawOf = (values: RuleFormValues) => ({
  category: values.category === ANY_CATEGORY ? null : values.category,
  minFollowers: values.minFollowers.trim() === "" ? null : Number(values.minFollowers),
  commission: {
    kind: values.kind,
    value: values.kind === "percent" ? Number(values.value.replace(",", ".").trim()) : parseMoneyToCents(values.value),
  },
});

const CATEGORY_OPTIONS = [
  { value: ANY_CATEGORY, label: "Todos os tipos de conta" },
  ...STOCK_CATEGORIES.map((category) => ({ value: category, label: STOCK_CATEGORY_LABEL[category] })),
];

const isCategoryOption = (value: string): value is RuleFormValues["category"] => value === ANY_CATEGORY || STOCK_CATEGORIES.some((item) => item === value);

/** Formulário de uma regra: tipo de conta, mínimo de seguidores (opcional) e a comissão em % ou R$. */
export function RuleForm({
  initial,
  submitLabel,
  pending = false,
  onSubmit,
  onCancel,
}: {
  initial: CommissionRuleData | null;
  submitLabel: string;
  pending?: boolean;
  onSubmit: (data: CommissionRuleData) => void | Promise<void>;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState<RuleFormValues>(() => (initial ? valuesOf(initial) : EMPTY_RULE));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const id = useId();
  const percent = values.kind === "percent";
  const update = (patch: Partial<RuleFormValues>) => setValues((current) => ({ ...current, ...patch }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const parsed = commissionRuleDataSchema.safeParse(rawOf(values));
    if (!parsed.success) {
      setErrors(fieldErrorsOf(parsed.error));
      return;
    }
    setErrors({});
    await onSubmit(parsed.data);
    if (!initial) setValues(EMPTY_RULE);
  };

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="space-y-4 rounded-2xl border border-line bg-ink/50 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Tipo de conta"
          name={`${id}-category`}
          value={values.category}
          options={CATEGORY_OPTIONS}
          onChange={(event) => {
            const next = event.target.value;
            if (isCategoryOption(next)) update({ category: next });
          }}
        />
        <TextField
          label="Só contas a partir de quantos seguidores (opcional)"
          name={`${id}-followers`}
          inputMode="numeric"
          autoComplete="off"
          placeholder="Ex.: 2000"
          value={values.minFollowers}
          onChange={(event) => update({ minFollowers: event.target.value.replace(/\D/g, "") })}
          error={errors.minFollowers}
        />
      </div>
      <SegmentedField<CommissionKind>
        legend="Comissão"
        name={`${id}-kind`}
        value={values.kind}
        options={COMMISSION_KINDS.map((kind) => ({ value: kind, label: COMMISSION_KIND_LABEL[kind] }))}
        onChange={(kind) => update({ kind, value: "" })}
      />
      <TextField
        label={percent ? "Comissão (%)" : "Comissão por venda (R$)"}
        name={`${id}-value`}
        inputMode={percent ? "numeric" : "decimal"}
        autoComplete="off"
        placeholder={percent ? "3" : "40,00"}
        value={values.value}
        onChange={(event) => update({ value: event.target.value })}
        error={errors["commission.value"] ?? errors["commission.kind"]}
        hint={percent ? `De 1% a ${MAX_COMMISSION_PERCENT}% do valor pago.` : "Valor fixo por conta vendida."}
      />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" variant="secondary" disabled={pending}>
          <Plus aria-hidden className="size-4" /> {pending ? "Salvando..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

/** Lista das regras, na ordem em que o sistema desempata. */
export function RuleList({
  rules,
  emptyText,
  busy = false,
  onEdit,
  onRemove,
}: {
  rules: readonly (CommissionRuleData & { id: string })[];
  emptyText: string;
  busy?: boolean;
  onEdit?: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  if (rules.length === 0) return <p className="text-sm text-mist">{emptyText}</p>;
  return (
    <ul className="divide-y divide-line rounded-2xl border border-line">
      {rules.map((rule) => {
        const summary = commissionRuleSummary(rule, formatBRL);
        return (
          <li key={rule.id} className="flex items-center gap-2 px-4 py-3 text-sm">
            <span className="min-w-0 flex-1 text-white">{summary}</span>
            {onEdit && (
              <Button variant="ghost" className="size-10 shrink-0 px-0" disabled={busy} onClick={() => onEdit(rule.id)} aria-label={`Editar a regra ${summary}`}>
                <Pencil aria-hidden className="size-4" />
              </Button>
            )}
            <Button variant="ghost" className="size-10 shrink-0 px-0" disabled={busy} onClick={() => onRemove(rule.id)} aria-label={`Apagar a regra ${summary}`}>
              <Trash2 aria-hidden className="size-4" />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

/** Regras gravadas no banco (de todos, de um afiliado ou de um convite), com editar e apagar. */
export function CommissionRulesEditor({
  title,
  description,
  rules,
  owner,
  onChanged,
  framed = true,
}: {
  title: string;
  description: string;
  rules: readonly AffiliateCommissionRule[];
  owner: CommissionRuleOwner;
  onChanged: () => void;
  framed?: boolean;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState<string | null>(null);
  const save = useMutation((deps, id: string | null, data: CommissionRuleData) => saveCommissionRule(deps, id, owner, data));
  const remove = useMutation(async (deps, id: string) => {
    await removeCommissionRule(deps, id);
    return true;
  });
  const editingRule = rules.find((rule) => rule.id === editing) ?? null;

  const onSave = async (data: CommissionRuleData) => {
    const saved = await save.run(editing, data);
    if (!saved) return;
    toast.show(editing ? "Regra atualizada. Vale para as próximas vendas." : "Regra criada. Vale para as próximas vendas.");
    setEditing(null);
    onChanged();
  };

  const onRemove = async (id: string) => {
    const done = await remove.run(id);
    if (!done) return;
    toast.show("Regra apagada.");
    onChanged();
  };

  const body = (
    <>
      <p className="rounded-xl border border-line bg-ink/40 px-4 py-3 text-xs text-fog">{COMMISSION_RULE_PRECEDENCE}</p>
      <RuleList
        rules={rules}
        emptyText="Nenhuma regra ainda."
        busy={remove.pending || save.pending}
        onEdit={setEditing}
        onRemove={(id) => void onRemove(id)}
      />
      {(save.error ?? remove.error) && <InlineError message={(save.error ?? remove.error)?.message ?? ""} />}
      <RuleForm
        key={editing ?? "new"}
        initial={editingRule}
        submitLabel={editingRule ? "Salvar regra" : "Adicionar regra"}
        pending={save.pending}
        onSubmit={onSave}
        onCancel={editingRule ? () => setEditing(null) : undefined}
      />
    </>
  );

  if (!framed) return <div className="space-y-4">{body}</div>;
  return (
    <FormSection title={title} description={description}>
      {body}
    </FormSection>
  );
}

/** Regras ainda não gravadas (o convite nasce junto com elas). */
export function DraftRulesEditor({ rules, onChange }: { rules: readonly CommissionRuleData[]; onChange: (rules: CommissionRuleData[]) => void }) {
  const withIds = rules.map((rule, index) => ({ ...rule, id: String(index) }));
  return (
    <div className="space-y-3">
      <p className="text-xs text-mist">{COMMISSION_RULE_PRECEDENCE}</p>
      <RuleList rules={withIds} emptyText="Sem regras: vale a comissão própria acima ou a padrão do programa." onRemove={(id) => onChange(rules.filter((_, index) => String(index) !== id))} />
      <RuleForm initial={null} submitLabel="Adicionar regra" onSubmit={(rule) => onChange([...rules, rule])} />
    </div>
  );
}
