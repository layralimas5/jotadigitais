import { ExternalLink, FileText } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { affiliateProgramSchema, saveAffiliateProgram } from "@/application/affiliate-use-cases";
import { fieldErrorsOf } from "@/application/schemas";
import {
  COMMISSION_KINDS,
  COMMISSION_KIND_LABEL,
  MAX_COMMISSION_PERCENT,
  commissionCents,
  type AffiliateProgram,
  type CommissionKind,
} from "@/domain/affiliate";
import { AFFILIATE_TERMS_TEMPLATE } from "@/domain/affiliate-terms-template";
import { formatBRL, formatCentsInput, parseMoneyToCents } from "@/domain/money";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/form/Fields";
import { FormSection } from "../components/AdminUi";
import { SegmentedField, TextAreaField, ToggleField } from "../components/FormControls";
import { FormFooter } from "../components/FormFooter";
import { useMutation } from "../hooks";
import { useToast } from "../toast";

interface ProgramFormValues {
  enabled: boolean;
  autoApprove: boolean;
  commissionKind: CommissionKind;
  commissionValue: string;
  linkDays: string;
  minWithdrawal: string;
  dailyAutoLimit: string;
  manualApprovalAbove: string;
  terms: string;
  welcomeText: string;
}

const SAMPLE_PRICE = 37_000;

const fromProgram = (program: AffiliateProgram): ProgramFormValues => ({
  enabled: program.enabled,
  autoApprove: program.autoApprove,
  commissionKind: program.commission.kind,
  commissionValue: program.commission.kind === "percent" ? String(program.commission.value) : formatCentsInput(program.commission.value),
  linkDays: String(program.linkDays),
  minWithdrawal: formatCentsInput(program.minWithdrawal),
  dailyAutoLimit: formatCentsInput(program.dailyAutoLimit),
  manualApprovalAbove: formatCentsInput(program.manualApprovalAbove),
  terms: program.terms,
  welcomeText: program.welcomeText ?? "",
});

const commissionValueOf = (values: ProgramFormValues) =>
  values.commissionKind === "percent" ? Number(values.commissionValue.replace(",", ".").trim()) : parseMoneyToCents(values.commissionValue);

const toRaw = (values: ProgramFormValues) => ({
  enabled: values.enabled,
  autoApprove: values.autoApprove,
  commission: { kind: values.commissionKind, value: commissionValueOf(values) },
  linkDays: Number(values.linkDays.trim()),
  minWithdrawal: parseMoneyToCents(values.minWithdrawal),
  dailyAutoLimit: parseMoneyToCents(values.dailyAutoLimit),
  manualApprovalAbove: parseMoneyToCents(values.manualApprovalAbove),
  terms: values.terms,
  welcomeText: values.welcomeText,
});

function validate(values: ProgramFormValues): Record<string, string> {
  const result = affiliateProgramSchema.safeParse(toRaw(values));
  const errors = result.success ? {} : fieldErrorsOf(result.error);
  if (values.enabled && values.terms.trim().length < 50) errors.terms = "Publique os termos do programa antes de ligar (use o texto-base, se quiser).";
  return errors;
}

function CommissionExample({ values }: { values: ProgramFormValues }) {
  const value = commissionValueOf(values);
  if (!Number.isFinite(value) || value <= 0) return null;
  const example = commissionCents({ kind: values.commissionKind, value }, SAMPLE_PRICE);
  return (
    <p className="rounded-xl border border-line bg-ink/60 px-4 py-3 text-sm text-fog">
      Numa conta de {formatBRL(SAMPLE_PRICE)}, o afiliado ganha <strong className="text-white">{formatBRL(example)}</strong>.
    </p>
  );
}

export function AffiliateProgramTab({ program, onSaved }: { program: AffiliateProgram; onSaved: () => void }) {
  const toast = useToast();
  const [values, setValues] = useState<ProgramFormValues>(() => fromProgram(program));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const save = useMutation(saveAffiliateProgram);
  const percent = values.commissionKind === "percent";

  const update = (patch: Partial<ProgramFormValues>) => {
    const next = { ...values, ...patch };
    setValues(next);
    if (submitted) setErrors(validate(next));
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.show("Revise os campos marcados em vermelho.", "error");
      return;
    }
    const saved = await save.run(toRaw(values));
    if (!saved) {
      toast.show("Não foi possível salvar. Veja o aviso no formulário.", "error");
      return;
    }
    setValues(fromProgram(saved));
    toast.show(saved.enabled ? "Programa salvo. As regras novas já valem." : "Programa salvo e desligado.");
    onSaved();
  };

  return (
    <form noValidate onSubmit={onSubmit} aria-busy={save.pending} className="grid max-w-3xl grid-cols-1 gap-6">
      <FormSection title="Programa" description="Desligado, ninguém se cadastra e os links param de contar venda. As comissões já geradas continuam.">
        <ToggleField label="Programa de afiliados ligado" checked={values.enabled} onChange={(enabled) => update({ enabled })} />
        <ToggleField
          label="Aprovar cadastros sozinho"
          description="Ligado, quem se cadastra já entra aprovado. Desligado, você aprova um a um na aba Afiliados."
          checked={values.autoApprove}
          onChange={(autoApprove) => update({ autoApprove })}
        />
        <Link to="/seja-afiliado" target="_blank" className="inline-flex items-center gap-1.5 text-sm font-medium text-electric hover:text-white">
          Ver a página “Seja afiliado” <ExternalLink aria-hidden className="size-3.5" />
        </Link>
      </FormSection>

      <FormSection title="Comissão padrão" description="Vale para todas as contas. Na ficha de cada conta dá para tirar a conta do programa ou dar outra comissão.">
        <SegmentedField<CommissionKind>
          legend="Tipo"
          name="commissionKind"
          value={values.commissionKind}
          options={COMMISSION_KINDS.map((kind) => ({ value: kind, label: COMMISSION_KIND_LABEL[kind] }))}
          onChange={(commissionKind) => update({ commissionKind, commissionValue: "" })}
        />
        <TextField
          label={percent ? "Comissão (%)" : "Comissão (R$)"}
          name="commissionValue"
          inputMode={percent ? "numeric" : "decimal"}
          autoComplete="off"
          placeholder={percent ? "10" : "30,00"}
          value={values.commissionValue}
          onChange={(event) => update({ commissionValue: event.target.value })}
          error={errors["commission.value"]}
          hint={percent ? `De 1% a ${MAX_COMMISSION_PERCENT}% do valor pago pelo cliente (já com desconto de cupom).` : "Valor fixo por conta vendida."}
        />
        <CommissionExample values={values} />
        <TextField
          label="O link vale por quantos dias"
          name="linkDays"
          inputMode="numeric"
          autoComplete="off"
          value={values.linkDays}
          onChange={(event) => update({ linkDays: event.target.value.replace(/\D/g, "") })}
          error={errors.linkDays}
          hint="Se o cliente clicar no link e comprar dentro desse prazo, a venda é do afiliado. O combinado é 30."
        />
      </FormSection>

      <FormSection
        title="Saques"
        description="Travas de segurança dos pagamentos de comissão. Os saques entram na próxima etapa; já pode deixar os valores definidos."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            label="Saque mínimo (R$)"
            name="minWithdrawal"
            inputMode="decimal"
            autoComplete="off"
            value={values.minWithdrawal}
            onChange={(event) => update({ minWithdrawal: event.target.value })}
            error={errors.minWithdrawal}
          />
          <TextField
            label="Limite diário automático (R$)"
            name="dailyAutoLimit"
            inputMode="decimal"
            autoComplete="off"
            value={values.dailyAutoLimit}
            onChange={(event) => update({ dailyAutoLimit: event.target.value })}
            error={errors.dailyAutoLimit}
          />
          <TextField
            label="Aprovar à mão acima de (R$)"
            name="manualApprovalAbove"
            inputMode="decimal"
            autoComplete="off"
            value={values.manualApprovalAbove}
            onChange={(event) => update({ manualApprovalAbove: event.target.value })}
            error={errors.manualApprovalAbove}
          />
        </div>
      </FormSection>

      <FormSection title="Textos" description="O recado aparece no topo do painel do afiliado. Os termos aparecem no cadastro e precisam ser aceitos.">
        <TextAreaField
          label="Recado de boas-vindas (opcional)"
          name="welcomeText"
          rows={3}
          maxLength={2000}
          placeholder="Ex.: Bem-vindo! Comece pelas contas de TikTok com Shop, são as que mais vendem."
          value={values.welcomeText}
          onChange={(event) => update({ welcomeText: event.target.value })}
          error={errors.welcomeText}
        />
        <TextAreaField
          label="Termos do programa"
          name="terms"
          rows={12}
          maxLength={20000}
          value={values.terms}
          onChange={(event) => update({ terms: event.target.value })}
          error={errors.terms}
          hint="Trocar os termos vale para os próximos cadastros. Revise os trechos [preencher: …] antes de publicar."
        />
        {values.terms.trim() === "" && (
          <Button variant="secondary" onClick={() => update({ terms: AFFILIATE_TERMS_TEMPLATE })}>
            <FileText aria-hidden className="size-4" /> Usar o texto-base
          </Button>
        )}
      </FormSection>

      <FormFooter
        submitLabel="Salvar programa"
        mobileSubmitLabel="Salvar"
        pending={save.pending}
        errors={[Object.keys(errors).length > 0 ? "Revise os campos marcados em vermelho." : null, save.error?.message]}
      />
    </form>
  );
}
