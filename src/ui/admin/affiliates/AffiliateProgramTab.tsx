import { ExternalLink, FileText } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { affiliateProgramSchema, listGlobalCommissionRules, saveAffiliateProgram } from "@/application/affiliate-use-cases";
import { fieldErrorsOf } from "@/application/schemas";
import {
  AFFILIATE_TEXT_DEFAULTS,
  AFFILIATE_TEXT_LIMITS,
  COMMISSION_KINDS,
  COMMISSION_KIND_LABEL,
  EMPTY_AFFILIATE_TEXTS,
  MAX_COMMISSION_PERCENT,
  affiliateText,
  commissionCents,
  type AffiliateProgram,
  type AffiliateTextKey,
  type CommissionKind,
} from "@/domain/affiliate";
import { incentiveEarning } from "@/domain/affiliate-rewards";
import { ErrorState } from "@/ui/components/StateViews";
import { CommissionRulesEditor } from "./CommissionRulesEditor";
import { AFFILIATE_TERMS_TEMPLATE } from "@/domain/affiliate-terms-template";
import { formatBRL, formatCentsInput, parseMoneyToCents } from "@/domain/money";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/form/Fields";
import { FormSection, LoadingBlock } from "../components/AdminUi";
import { SegmentedField, TextAreaField, ToggleField } from "../components/FormControls";
import { FormFooter } from "../components/FormFooter";
import { useAdminQuery, useMutation } from "../hooks";
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
  incentiveSales: string;
  bannerTitle: string;
  bannerText: string;
  texts: Record<AffiliateTextKey, string>;
}

/** Os textos novos da entrega 3: onde aparecem e quais marcadores aceitam. */
const TEXT_FIELDS: { key: AffiliateTextKey; label: string; hint: string; rows: number }[] = [
  { key: "incentive", label: "Incentivo da página Seja afiliado", hint: "Marcadores: {vendas} e {valor}.", rows: 2 },
  { key: "earnRule", label: "Como o afiliado ganha (página Seja afiliado)", hint: "Marcador: {dias} (dias de garantia da aba Site).", rows: 3 },
  { key: "payoutInfo", label: "Explicação do pagamento (painel do afiliado)", hint: "Marcador: {dias}.", rows: 3 },
  { key: "balanceNotice", label: "Aviso de comprar conta com o saldo (painel e página Seja afiliado)", hint: "Sem marcadores.", rows: 2 },
  { key: "inviteMessage", label: "Mensagem do convite no WhatsApp", hint: "Marcadores: {nome} (primeiro nome) e {link} (link do convite).", rows: 3 },
];

const SAMPLE_PRICE = 150_000;

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
  incentiveSales: String(program.incentiveSales),
  bannerTitle: program.bannerTitle ?? "",
  bannerText: program.bannerText ?? "",
  texts: {
    incentive: program.texts.incentive ?? "",
    earnRule: program.texts.earnRule ?? "",
    payoutInfo: program.texts.payoutInfo ?? "",
    balanceNotice: program.texts.balanceNotice ?? "",
    inviteMessage: program.texts.inviteMessage ?? "",
  },
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
  incentiveSales: Number(values.incentiveSales.trim()),
  bannerTitle: values.bannerTitle,
  bannerText: values.bannerText,
  texts: values.texts,
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

/** "A cada 10 vendas você recebe R$ 450,00 no total", com a comissão e o texto do formulário. */
function IncentivePreview({ values }: { values: ProgramFormValues }) {
  const value = commissionValueOf(values);
  const sales = Number(values.incentiveSales);
  if (!Number.isFinite(value) || value <= 0 || !Number.isInteger(sales) || sales <= 0) return null;
  const sentence = affiliateText({ ...EMPTY_AFFILIATE_TEXTS, incentive: values.texts.incentive || null }, "incentive", {
    vendas: sales,
    valor: formatBRL(incentiveEarning({ kind: values.commissionKind, value }, sales)),
  });
  return (
    <p className="rounded-xl border border-line bg-ink/60 px-4 py-3 text-sm text-fog">
      Na página: <strong className="text-white">{sentence}</strong>
    </p>
  );
}

/** Regras de comissão para todos os afiliados (ex.: Shop piloto R$ 20). Gravadas na hora, fora do formulário. */
function GlobalRulesSection() {
  const rules = useAdminQuery(listGlobalCommissionRules, "admin-affiliate-global-rules");
  if (rules.status === "loading") return <LoadingBlock label="Carregando as regras" />;
  if (rules.status === "error") return <ErrorState message={rules.error.message} onRetry={rules.reload} />;
  return (
    <CommissionRulesEditor
      title="Regras para todos os afiliados"
      description="Comissão diferente por tipo de conta ou por quantidade de seguidores, para todo afiliado. Ex.: Shop piloto paga R$ 20 por venda. Cada afiliado ainda pode ter regras só dele na ficha."
      rules={rules.data}
      owner={{ kind: "all" }}
      onChanged={rules.reload}
    />
  );
}

export function AffiliateProgramTab({ program, onSaved }: { program: AffiliateProgram; onSaved: () => void }) {
  return (
    <div className="grid max-w-3xl grid-cols-1 gap-6">
      <ProgramForm program={program} onSaved={onSaved} />
      <GlobalRulesSection />
    </div>
  );
}

function ProgramForm({ program, onSaved }: { program: AffiliateProgram; onSaved: () => void }) {
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
    <form noValidate onSubmit={onSubmit} aria-busy={save.pending} className="grid grid-cols-1 gap-6">
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
        title="Exemplo de ganho da página Seja afiliado"
        description="Não existe mais lote: cada venda pode ser paga quando a garantia acaba. Este número só monta o exemplo que motiva quem está conhecendo o programa."
      >
        <TextField
          label="Vendas no exemplo de ganho da página Seja afiliado"
          name="incentiveSales"
          inputMode="numeric"
          autoComplete="off"
          value={values.incentiveSales}
          onChange={(event) => update({ incentiveSales: event.target.value.replace(/\D/g, "") })}
          error={errors.incentiveSales}
          hint="Ex.: 10 mostra quanto a pessoa ganha a cada 10 vendas de uma conta de R$ 1.500,00."
        />
        <IncentivePreview values={values} />
      </FormSection>

      <FormSection
        title="Saques"
        description="Travas de segurança dos pagamentos. O mínimo é R$ 1,00: qualquer venda liberada já pode ser paga."
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

      <FormSection
        title="Textos"
        description="A faixa e o recado aparecem no topo do painel do afiliado; os outros, na página Seja afiliado, no painel e no convite. Os termos aparecem no cadastro e precisam ser aceitos."
      >
        <TextField
          label="Chamada da faixa do painel (opcional)"
          name="bannerTitle"
          maxLength={120}
          autoComplete="off"
          placeholder="Indique e ganhe em cada conta vendida"
          value={values.bannerTitle}
          onChange={(event) => update({ bannerTitle: event.target.value })}
          error={errors.bannerTitle}
        />
        <TextAreaField
          label="Texto da faixa (opcional)"
          name="bannerText"
          rows={2}
          maxLength={500}
          placeholder="Ex.: Esta semana as contas com TikTok Shop estão saindo rápido. Divulgue agora!"
          value={values.bannerText}
          onChange={(event) => update({ bannerText: event.target.value })}
          error={errors.bannerText}
        />
        {TEXT_FIELDS.map((field) => (
          <TextAreaField
            key={field.key}
            label={`${field.label} (opcional)`}
            name={`text-${field.key}`}
            rows={field.rows}
            maxLength={AFFILIATE_TEXT_LIMITS[field.key]}
            placeholder={AFFILIATE_TEXT_DEFAULTS[field.key]}
            value={values.texts[field.key]}
            onChange={(event) => update({ texts: { ...values.texts, [field.key]: event.target.value } })}
            error={errors[`texts.${field.key}`]}
            hint={`Em branco, vale o texto de exemplo. ${field.hint}`}
          />
        ))}
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
