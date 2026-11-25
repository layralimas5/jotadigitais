import { useState, type FormEvent } from "react";
import { affiliateCommissionSchema, assignOrderToAffiliate, saveAffiliateCommission, type AffiliateDetail } from "@/application/affiliate-use-cases";
import { fieldErrorsOf } from "@/application/schemas";
import {
  COMMISSION_KINDS,
  COMMISSION_KIND_LABEL,
  MAX_COMMISSION_PERCENT,
  affiliateLink,
  commissionCents,
  commissionRuleLabel,
  type CommissionKind,
  type CommissionRule,
} from "@/domain/affiliate";
import { affiliateWhatsAppLink } from "@/domain/affiliate-rewards";
import { formatBRL, formatCentsInput, parseMoneyToCents } from "@/domain/money";
import { LinkBox } from "@/ui/affiliate/components/AffiliateUi";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/form/Fields";
import { FormSection, InlineError } from "../components/AdminUi";
import { SegmentedField, ToggleField } from "../components/FormControls";
import { useMutation } from "../hooks";
import { useToast } from "../toast";
import { AffiliatePayoutCard, PayDialog, type PayRequest } from "./AffiliatePayoutsTab";

const SAMPLE_PRICE = 150_000;

const ruleValueText = (rule: CommissionRule) => (rule.kind === "percent" ? String(rule.value) : formatCentsInput(rule.value));

/** Comissão só dele: o Jota prioriza quem está há mais tempo ou vende mais. */
export function OwnCommissionSection({ detail, onSaved }: { detail: AffiliateDetail; onSaved: () => void }) {
  const toast = useToast();
  const current = detail.affiliate.commission;
  const [custom, setCustom] = useState(current !== null);
  const [kind, setKind] = useState<CommissionKind>(current?.kind ?? "percent");
  const [value, setValue] = useState(current ? ruleValueText(current) : "");
  const [error, setError] = useState<string | null>(null);
  const save = useMutation(async (deps, id: string, raw: unknown) => {
    await saveAffiliateCommission(deps, id, raw);
    return true;
  });
  const percent = kind === "percent";
  const numeric = percent ? Number(value.replace(",", ".").trim()) : parseMoneyToCents(value);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const raw = custom ? { kind, value: numeric } : null;
    const result = affiliateCommissionSchema.safeParse(raw);
    if (!result.success) {
      setError(fieldErrorsOf(result.error).value ?? "Confira a comissão.");
      return;
    }
    setError(null);
    const done = await save.run(detail.affiliate.id, raw);
    if (!done) return;
    toast.show(custom ? "Comissão própria salva. Vale para as próximas vendas dele." : "Ele volta a ganhar a comissão padrão do programa.");
    onSaved();
  };

  return (
    <FormSection
      title="Comissão deste afiliado"
      description={`Padrão do programa: ${commissionRuleLabel(detail.program.commission, formatBRL)}. Conta com comissão própria paga a dela, a não ser que a deste afiliado dê mais.`}
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <ToggleField label="Dar uma comissão só para ele" checked={custom} onChange={setCustom} />
        {custom && (
          <>
            <SegmentedField<CommissionKind>
              legend="Tipo"
              name="ownCommissionKind"
              value={kind}
              options={COMMISSION_KINDS.map((item) => ({ value: item, label: COMMISSION_KIND_LABEL[item] }))}
              onChange={(next) => {
                setKind(next);
                setValue("");
              }}
            />
            <TextField
              label={percent ? "Comissão (%)" : "Comissão (R$)"}
              name="ownCommissionValue"
              inputMode={percent ? "numeric" : "decimal"}
              autoComplete="off"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              error={error ?? undefined}
              hint={percent ? `De 1% a ${MAX_COMMISSION_PERCENT}%.` : "Valor fixo por conta vendida."}
            />
            {Number.isFinite(numeric) && numeric > 0 && (
              <p className="rounded-xl border border-line bg-ink/60 px-4 py-3 text-sm text-fog">
                Numa conta de {formatBRL(SAMPLE_PRICE)}, ele ganha <strong className="text-white">{formatBRL(commissionCents({ kind, value: numeric }, SAMPLE_PRICE))}</strong>.
              </p>
            )}
          </>
        )}
        {save.error && <InlineError message={save.error.message} />}
        <Button type="submit" disabled={save.pending}>
          {save.pending ? "Salvando..." : "Salvar comissão"}
        </Button>
      </form>
    </FormSection>
  );
}

/** Progresso até o próximo lote e o "Paguei" direto da ficha. */
export function PayoutSection({ detail, onPaid }: { detail: AffiliateDetail; onPaid: () => void }) {
  const [request, setRequest] = useState<PayRequest | null>(null);
  return (
    <FormSection title="Pagamento" description={`Você paga a cada ${detail.program.payoutBatchSize} indicações. Mude o número na aba Programa.`}>
      <ul>
        <AffiliatePayoutCard summary={detail} onPay={setRequest} showName={false} />
      </ul>
      <PayDialog
        request={request}
        onClose={() => setRequest(null)}
        onPaid={() => {
          setRequest(null);
          onPaid();
        }}
      />
    </FormSection>
  );
}

/** Links para o Jota mandar ao cliente indicado: a compra pelo link conta para este afiliado. */
export function ReferralLinksSection({ detail }: { detail: AffiliateDetail }) {
  const origin = window.location.origin;
  return (
    <FormSection
      title="Links de indicação"
      description={`Cliente que chegou indicado por ele no WhatsApp: mande o link da loja abaixo. ${detail.whatsappLeads} ${detail.whatsappLeads === 1 ? "contato chegou" : "contatos chegaram"} pelo link de WhatsApp dele.`}
    >
      <div className="space-y-3">
        <div>
          <p className="mb-1.5 text-sm font-medium text-fog">Link da loja para mandar ao cliente</p>
          <LinkBox link={affiliateLink(origin, detail.affiliate.code)} />
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium text-fog">Link de WhatsApp dele</p>
          <LinkBox link={affiliateWhatsAppLink(origin, detail.affiliate.code)} />
        </div>
      </div>
    </FormSection>
  );
}

/** Venda que já aconteceu sem link nem cupom: o Jota diz de quem é e a comissão nasce. */
export function AssignOrderSection({ detail, onAssigned }: { detail: AffiliateDetail; onAssigned: () => void }) {
  const toast = useToast();
  const [orderCode, setOrderCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const assign = useMutation(assignOrderToAffiliate);
  const approved = detail.affiliate.status === "approved";

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!orderCode.trim()) {
      setError("Informe o código do pedido (ex.: JD-ABC123).");
      return;
    }
    setError(null);
    const created = await assign.run({ orderCode, affiliateId: detail.affiliate.id });
    if (created === undefined) return;
    toast.show(
      created > 0
        ? `Venda atribuída a ${detail.affiliate.name}. A comissão já entrou no extrato dele.`
        : `Pedido ligado a ${detail.affiliate.name}. A comissão nasce quando o pagamento cair.`,
    );
    setOrderCode("");
    onAssigned();
  };

  return (
    <FormSection
      title="Atribuir uma venda"
      description="O cliente veio indicado por ele, mas esqueceu o cupom ou comprou sem o link? Informe o pedido e a venda passa a contar para ele."
    >
      {approved ? (
        <form onSubmit={onSubmit} noValidate className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
          <TextField
            label="Código do pedido"
            name="assignOrderCode"
            autoComplete="off"
            spellCheck={false}
            placeholder="JD-ABC123"
            className="[&_input]:font-mono [&_input]:uppercase"
            value={orderCode}
            onChange={(event) => setOrderCode(event.target.value.toUpperCase().replace(/\s+/g, ""))}
            error={error ?? undefined}
          />
          <Button type="submit" className="sm:mt-7" disabled={assign.pending}>
            {assign.pending ? "Atribuindo..." : "Atribuir venda"}
          </Button>
        </form>
      ) : (
        <p className="text-sm text-mist">Aprove o afiliado para atribuir vendas a ele.</p>
      )}
      {assign.error && <InlineError message={assign.error.message} />}
    </FormSection>
  );
}
