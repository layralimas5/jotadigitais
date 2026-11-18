import { ArrowLeft, Copy, Eye, TicketPercent } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  affiliateCouponSchema,
  cancelAffiliateCommission,
  changeAffiliateStatus,
  createAffiliateCoupon,
  linkAffiliatePartner,
  loadAffiliateDetail,
  revealAffiliateDocument,
  type AffiliateDetail,
} from "@/application/affiliate-use-cases";
import { fieldErrorsOf } from "@/application/schemas";
import { AFFILIATE_STATUSES, AFFILIATE_STATUS_LABEL, affiliateLink, type AffiliateCommission, type AffiliateStatus } from "@/domain/affiliate";
import { formatDocument } from "@/domain/brazil";
import { normalizeCouponCode } from "@/domain/coupon";
import { formatBRL } from "@/domain/money";
import { AffiliateStatusBadge } from "@/ui/components/affiliate/AffiliateBadges";
import { CommissionList } from "@/ui/components/affiliate/CommissionList";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/form/Fields";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { FormSection, InlineError, LoadingBlock, PageHeader } from "../components/AdminUi";
import { partnersTabPath } from "../affiliates/PartnersTabs";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { SelectField, TextAreaField } from "../components/FormControls";
import { Kpi } from "../components/Kpi";
import { useAdminQuery, useMutation } from "../hooks";
import { formatDate } from "../lib/dates";
import { useToast } from "../toast";

const BACK_PATH = partnersTabPath("afiliados");

const STATUS_HINT: Record<AffiliateStatus, string> = {
  pending: "Ainda não divulga: o link não conta clique nem venda.",
  approved: "Divulga, vê a vitrine e recebe comissão.",
  rejected: "Cadastro recusado. Não entra no painel de afiliado.",
  suspended: "Pausa: o link para de contar venda até você aprovar de novo. Comissões já geradas continuam.",
  blocked: "Fim da parceria: o link para de contar venda.",
};

function ProfileFacts({ detail }: { detail: AffiliateDetail }) {
  const toast = useToast();
  const { affiliate } = detail;
  const [document, setDocument] = useState<string | null>(null);
  const reveal = useMutation((deps, id: string) => revealAffiliateDocument(deps, id));
  const link = affiliateLink(window.location.origin, affiliate.code);

  const showDocument = async () => {
    const value = await reveal.run(affiliate.id);
    setDocument(value ?? "Sem acesso ao CPF");
  };

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    toast.show("Link geral copiado.");
  };

  const facts: [string, string][] = [
    ["E-mail", affiliate.email],
    ["WhatsApp", affiliate.whatsapp ?? "Não informou"],
    ["Chave Pix", affiliate.pixKey ?? "Ainda não cadastrou"],
    ["Cadastro", formatDate(affiliate.createdAt)],
    ["Aceitou os termos", formatDate(affiliate.termsAcceptedAt)],
    ["Aprovado em", affiliate.approvedAt ? formatDate(affiliate.approvedAt) : "Não aprovado"],
  ];

  return (
    <FormSection title="Ficha">
      <dl className="grid gap-3 sm:grid-cols-2">
        {facts.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-mist">{label}</dt>
            <dd className="truncate text-sm text-white">{value}</dd>
          </div>
        ))}
        <div className="min-w-0">
          <dt className="text-xs text-mist">CPF</dt>
          <dd className="text-sm text-white">
            {document !== null ? (
              /^\d{11}$/.test(document) ? formatDocument(document) : document
            ) : (
              <button type="button" onClick={() => void showDocument()} disabled={reveal.pending} className="inline-flex items-center gap-1.5 font-medium text-electric hover:text-white">
                <Eye aria-hidden className="size-3.5" /> {reveal.pending ? "Abrindo…" : "Ver CPF"}
              </button>
            )}
          </dd>
        </div>
      </dl>
      <div className="flex min-w-0 items-center gap-2 rounded-xl border border-line bg-ink/60 px-3 py-2.5">
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-fog">{link}</span>
        <button type="button" onClick={() => void copy()} aria-label="Copiar link geral" className="grid size-8 shrink-0 place-items-center rounded-full text-mist hover:bg-white/[0.06] hover:text-white">
          <Copy aria-hidden className="size-4" />
        </button>
      </div>
      {reveal.error && <InlineError message={reveal.error.message} />}
    </FormSection>
  );
}

function StatusSection({ detail, onSaved }: { detail: AffiliateDetail; onSaved: () => void }) {
  const toast = useToast();
  const [status, setStatus] = useState<AffiliateStatus>(detail.affiliate.status);
  const [note, setNote] = useState(detail.affiliate.statusNote ?? "");
  const save = useMutation(async (deps, id: string, raw: unknown) => {
    await changeAffiliateStatus(deps, id, raw);
    return true;
  });
  const changed = status !== detail.affiliate.status || note !== (detail.affiliate.statusNote ?? "");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const done = await save.run(detail.affiliate.id, { status, statusNote: note });
    if (!done) return;
    toast.show(`Situação: ${AFFILIATE_STATUS_LABEL[status]}.`);
    onSaved();
  };

  return (
    <form onSubmit={onSubmit} noValidate>
      <FormSection title="Situação" description={STATUS_HINT[status]}>
        <SelectField
          label="Situação do afiliado"
          value={status}
          onChange={(event) => setStatus(event.target.value as AffiliateStatus)}
          options={AFFILIATE_STATUSES.map((value) => ({ value, label: AFFILIATE_STATUS_LABEL[value] }))}
        />
        <TextAreaField
          label="Anotação interna (opcional)"
          rows={2}
          maxLength={500}
          placeholder="Ex.: suspenso por divulgar promessa de ganho."
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        {save.error && <InlineError message={save.error.message} />}
        <div className="flex justify-end">
          <Button type="submit" disabled={!changed || save.pending}>
            {save.pending ? "Salvando…" : "Salvar situação"}
          </Button>
        </div>
      </FormSection>
    </form>
  );
}

function PartnerSection({ detail, onSaved }: { detail: AffiliateDetail; onSaved: () => void }) {
  const toast = useToast();
  const link = useMutation(async (deps, id: string, partnerId: string | null) => {
    await linkAffiliatePartner(deps, id, partnerId);
    return true;
  });

  const onChange = async (partnerId: string) => {
    const done = await link.run(detail.affiliate.id, partnerId || null);
    if (!done) return;
    toast.show(partnerId ? "Afiliado ligado ao parceiro." : "Ligação com o parceiro removida.");
    onSaved();
  };

  return (
    <FormSection title="Parceiro" description="Se a pessoa também te fornece contas, ligue ao cadastro de parceiro dela para ver tudo junto.">
      <SelectField
        label="Parceiro ligado"
        value={detail.affiliate.partnerId ?? ""}
        disabled={link.pending}
        onChange={(event) => void onChange(event.target.value)}
        options={[{ value: "", label: "Nenhum" }, ...detail.partners.map((partner) => ({ value: partner.id, label: partner.name }))]}
      />
      {detail.partner && (
        <Link to={`/admin/parceiros/${detail.partner.id}`} className="text-sm font-medium text-electric hover:text-white">
          Abrir o cadastro de {detail.partner.name}
        </Link>
      )}
      {link.error && <InlineError message={link.error.message} />}
    </FormSection>
  );
}

function CouponSection({ detail, onSaved }: { detail: AffiliateDetail; onSaved: () => void }) {
  const toast = useToast();
  const [code, setCode] = useState("");
  const [value, setValue] = useState("10");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const create = useMutation(async (deps, id: string, raw: unknown) => {
    await createAffiliateCoupon(deps, id, raw);
    return true;
  });
  const approved = detail.affiliate.status === "approved";

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const raw = { code, kind: "percent", value: Number(value.trim()) };
    const result = affiliateCouponSchema.safeParse(raw);
    setErrors(result.success ? {} : fieldErrorsOf(result.error));
    if (!result.success) return;
    const done = await create.run(detail.affiliate.id, raw);
    if (!done) return;
    toast.show(`Cupom ${normalizeCouponCode(code)} criado. Já aparece no painel do afiliado.`);
    setCode("");
    onSaved();
  };

  return (
    <FormSection
      title="Cupom exclusivo"
      description="Desconto para o cliente e venda garantida para o afiliado: o cupom vence o link de outro afiliado. Edite ou pause na aba Cupons."
    >
      {detail.coupons.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {detail.coupons.map((coupon) => (
            <li key={coupon.code} className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1 font-mono text-sm text-white">
              <TicketPercent aria-hidden className="size-4 text-electric" /> {coupon.code}
              <span className="font-sans text-xs text-mist">{coupon.kind === "percent" ? `${coupon.value}%` : formatBRL(coupon.value)}</span>
            </li>
          ))}
        </ul>
      )}
      {approved ? (
        <form onSubmit={onSubmit} noValidate className="grid gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-start">
          <TextField
            label="Código"
            name="code"
            autoComplete="off"
            spellCheck={false}
            maxLength={30}
            placeholder={`Ex.: ${detail.affiliate.name.split(" ")[0]?.toUpperCase() ?? "NOME"}10`}
            className="[&_input]:font-mono [&_input]:uppercase"
            value={code}
            onChange={(event) => setCode(normalizeCouponCode(event.target.value).replace(/\s+/g, ""))}
            error={errors.code}
          />
          <TextField
            label="Desconto (%)"
            name="value"
            inputMode="numeric"
            value={value}
            onChange={(event) => setValue(event.target.value.replace(/\D/g, ""))}
            error={errors.value}
          />
          <Button type="submit" className="sm:mt-7" disabled={create.pending}>
            {create.pending ? "Criando…" : "Criar cupom"}
          </Button>
        </form>
      ) : (
        <p className="text-sm text-mist">Aprove o afiliado para criar o cupom dele.</p>
      )}
      {create.error && <InlineError message={create.error.message} />}
    </FormSection>
  );
}

function AffiliateDetailView({ detail, reload }: { detail: AffiliateDetail; reload: () => void }) {
  const toast = useToast();
  const { affiliate, totals } = detail;
  const [canceling, setCanceling] = useState<AffiliateCommission | null>(null);
  const cancel = useMutation(async (deps, id: string) => {
    await cancelAffiliateCommission(deps, id);
    return true;
  });

  const confirmCancel = async () => {
    if (!canceling) return;
    const done = await cancel.run(canceling.id);
    if (!done) return;
    toast.show(`Comissão do pedido ${canceling.orderCode} cancelada.`);
    setCanceling(null);
    reload();
  };

  return (
    <>
      <Link to={BACK_PATH} className="inline-flex items-center gap-2 text-sm text-mist hover:text-white">
        <ArrowLeft aria-hidden className="size-4" /> Voltar para os afiliados
      </Link>
      <div className="mt-4">
        <PageHeader
          title={affiliate.name}
          description={
            <span className="flex flex-wrap items-center gap-2">
              <AffiliateStatusBadge status={affiliate.status} /> <span className="font-mono text-xs">?ref={affiliate.code}</span>
            </span>
          }
        />
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Cliques" value={String(detail.clicks)} />
        <Kpi label="Vendas" value={String(totals.sales)} hint={detail.conversion === null ? "Sem cliques ainda" : `${detail.conversion.toLocaleString("pt-BR")}% dos cliques`} />
        <Kpi label="Pendente" value={formatBRL(totals.pending)} hint="Garantia correndo" />
        <Kpi label="Liberado" value={formatBRL(totals.released)} hint="Pronto para pagar" />
        <Kpi label="Pago" value={formatBRL(totals.paid)} />
      </dl>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <ProfileFacts detail={detail} />
          <PartnerSection detail={detail} onSaved={reload} />
        </div>
        <div className="space-y-6">
          <StatusSection key={`${affiliate.status}:${affiliate.statusNote ?? ""}`} detail={detail} onSaved={reload} />
          <CouponSection detail={detail} onSaved={reload} />
        </div>
      </div>

      <section aria-labelledby="commissions-title" className="mt-8 space-y-4">
        <h2 id="commissions-title" className="font-display text-lg font-semibold text-white">
          Comissões
        </h2>
        {cancel.error && <InlineError message={cancel.error.message} />}
        {detail.commissions.length === 0 ? (
          <EmptyState title="Nenhuma venda ainda" description="Quando alguém pagar um pedido pelo link ou cupom deste afiliado, a comissão aparece aqui." />
        ) : (
          <CommissionList commissions={detail.commissions} onCancel={setCanceling} />
        )}
      </section>

      <ConfirmDialog
        open={canceling !== null}
        title="Cancelar esta comissão?"
        description={
          canceling ? (
            <>
              A comissão de <strong className="text-white">{formatBRL(canceling.amount)}</strong> do pedido {canceling.orderCode} sai do saldo do afiliado.
              Use quando a venda for devolvida ou houver fraude. Não dá para desfazer.
            </>
          ) : null
        }
        confirmLabel="Cancelar comissão"
        pending={cancel.pending}
        onConfirm={() => void confirmCancel()}
        onClose={() => setCanceling(null)}
      />
    </>
  );
}

export default function AffiliateDetailPage() {
  const { id = "" } = useParams();
  const detail = useAdminQuery((deps) => loadAffiliateDetail(deps, id), `affiliate:${id}`);

  if (detail.status === "loading") return <LoadingBlock />;
  if (detail.status === "error") return <ErrorState message={detail.error.message} onRetry={detail.reload} />;
  if (!detail.data) {
    return (
      <EmptyState
        title="Afiliado não encontrado"
        description="Ele pode ter sido apagado. Volte para a lista de afiliados."
        action={
          <Link to={BACK_PATH} className="text-sm font-medium text-electric hover:text-white">
            Voltar para os afiliados
          </Link>
        }
      />
    );
  }
  return <AffiliateDetailView detail={detail.data} reload={detail.reload} />;
}
