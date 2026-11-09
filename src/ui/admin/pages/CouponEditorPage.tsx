import { ArrowLeft } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { deleteCoupon, findCoupon, saveCoupon } from "@/application/admin-use-cases";
import { couponDataSchema, fieldErrorsOf } from "@/application/schemas";
import {
  COUPON_KIND_LABEL,
  COUPON_KINDS,
  COUPON_STATUS_LABEL,
  couponDiscount,
  couponStatusOf,
  MAX_COUPON_PERCENT,
  normalizeCouponCode,
  type Coupon,
  type CouponKind,
} from "@/domain/coupon";
import { formatBRL, formatCentsInput, parseMoneyToCents } from "@/domain/money";
import { TextField } from "@/ui/components/form/Fields";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { FormSection, LoadingBlock, PageHeader } from "../components/AdminUi";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { SegmentedField, TextAreaField, ToggleField } from "../components/FormControls";
import { FormFooter } from "../components/FormFooter";
import { useAdminQuery, useMutation } from "../hooks";
import { localIsoDate } from "../lib/dates";
import { useToast } from "../toast";

const LIST_PATH = "/admin/cupons";
/** Conta de exemplo da prévia: o preço mais comum da vitrine. */
const SAMPLE_PRICE = 37_000;
const DAY_MS = 24 * 60 * 60 * 1000;

interface CouponFormValues {
  code: string;
  kind: CouponKind;
  /** "10" (porcentagem) ou "50,00" (reais), como foi digitado. */
  value: string;
  active: boolean;
  /** AAAA-MM-DD; vazio = sem data. */
  startsOn: string;
  /** Último dia que vale (inclusivo). */
  endsOn: string;
  maxUses: string;
  notes: string;
}

const EMPTY: CouponFormValues = { code: "", kind: "percent", value: "", active: true, startsOn: "", endsOn: "", maxUses: "", notes: "" };

const FIELD_ORDER = ["code", "value", "startsAt", "endsAt", "maxUses", "notes"] as const;

/** O fim no banco é exclusivo: "vale até 30/11" vira meia-noite de 01/12. */
const startOfDay = (isoDate: string) => new Date(`${isoDate}T00:00:00`).toISOString();
const endOfDay = (isoDate: string) => new Date(new Date(`${isoDate}T00:00:00`).getTime() + DAY_MS).toISOString();

const fromCoupon = (coupon: Coupon): CouponFormValues => ({
  code: coupon.code,
  kind: coupon.kind,
  value: coupon.kind === "percent" ? String(coupon.value) : formatCentsInput(coupon.value),
  active: coupon.active,
  startsOn: coupon.startsAt ? localIsoDate(new Date(coupon.startsAt)) : "",
  endsOn: coupon.endsAt ? localIsoDate(new Date(new Date(coupon.endsAt).getTime() - 1)) : "",
  maxUses: coupon.maxUses === null ? "" : String(coupon.maxUses),
  notes: coupon.notes ?? "",
});

function valueOf(values: CouponFormValues): number {
  if (values.kind === "percent") return Number(values.value.replace(",", ".").trim());
  return parseMoneyToCents(values.value);
}

const toRaw = (values: CouponFormValues) => ({
  code: values.code,
  kind: values.kind,
  value: valueOf(values),
  active: values.active,
  startsAt: values.startsOn ? startOfDay(values.startsOn) : null,
  endsAt: values.endsOn ? endOfDay(values.endsOn) : null,
  maxUses: values.maxUses.trim() ? Number(values.maxUses.trim()) : null,
  notes: values.notes,
});

function validate(values: CouponFormValues) {
  const result = couponDataSchema.safeParse(toRaw(values));
  return result.success ? { data: result.data, errors: {} } : { data: null, errors: fieldErrorsOf(result.error) };
}

/** "Numa conta de R$ 370,00, sai por R$ 333,00": o Jota vê o efeito antes de salvar. */
function DiscountPreview({ values }: { values: CouponFormValues }) {
  const value = valueOf(values);
  if (!Number.isFinite(value) || value <= 0) return null;
  const discount = couponDiscount({ kind: values.kind, value }, SAMPLE_PRICE);
  return (
    <p className="rounded-xl border border-emerald-400/25 bg-emerald-400/[0.06] px-4 py-3 text-sm text-emerald-100">
      Numa conta de {formatBRL(SAMPLE_PRICE)}, o cliente paga <strong className="text-white">{formatBRL(SAMPLE_PRICE - discount)}</strong>{" "}
      ({formatBRL(discount)} de desconto).
    </p>
  );
}

function CouponEditor({ coupon }: { coupon: Coupon | null }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [values, setValues] = useState<CouponFormValues>(() => (coupon ? fromCoupon(coupon) : EMPTY));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const save = useMutation((deps, raw: unknown) => saveCoupon(deps, coupon?.id ?? null, raw));
  const remove = useMutation(async (deps, id: string) => {
    await deleteCoupon(deps, id);
    return true;
  });

  const update = (patch: Partial<CouponFormValues>) => {
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
      if (first) formElement.querySelector<HTMLElement>(`[data-field="${first}"]`)?.focus();
      toast.show("Revise os campos marcados em vermelho.", "error");
      return;
    }
    const saved = await save.run(toRaw(values));
    if (!saved) {
      toast.show("Não foi possível salvar. Veja o aviso no formulário.", "error");
      return;
    }
    toast.show(`Cupom ${saved.code} salvo. Já vale no checkout.`);
    navigate(LIST_PATH);
  };

  const onDelete = async () => {
    if (!coupon) return;
    const removed = await remove.run(coupon.id);
    if (!removed) return;
    toast.show(`Cupom ${coupon.code} apagado.`);
    navigate(LIST_PATH);
  };

  const percent = values.kind === "percent";

  return (
    <>
      <Link to={LIST_PATH} className="inline-flex items-center gap-2 text-sm text-mist hover:text-white">
        <ArrowLeft aria-hidden className="size-4" /> Voltar para os cupons
      </Link>
      <div className="mt-4">
        <PageHeader
          title={coupon ? `Cupom ${coupon.code}` : "Novo cupom"}
          description={
            coupon
              ? `${COUPON_STATUS_LABEL[couponStatusOf(coupon)]} · ${coupon.uses} ${coupon.uses === 1 ? "uso" : "usos"} em pedidos não cancelados.`
              : "O cliente digita o código no checkout e o desconto entra no total, no Pix e no cartão."
          }
        />
      </div>

      <form noValidate onSubmit={onSubmit} aria-busy={save.pending} className="mt-6 grid max-w-3xl grid-cols-1 gap-6">
        <div className="space-y-5">
          <FormSection title="Desconto">
            <TextField
              label="Código do cupom"
              name="code"
              data-field="code"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={30}
              placeholder="Ex.: BLACK10"
              className="[&_input]:font-mono [&_input]:uppercase [&_input]:tracking-wide"
              value={values.code}
              onChange={(event) => update({ code: normalizeCouponCode(event.target.value).replace(/\s+/g, "") })}
              error={errors.code}
              hint="É o que o cliente digita. Letras, números, - ou _, sem espaços."
            />
            <SegmentedField<CouponKind>
              legend="Tipo"
              name="kind"
              value={values.kind}
              options={COUPON_KINDS.map((kind) => ({ value: kind, label: COUPON_KIND_LABEL[kind] }))}
              onChange={(kind) => update({ kind, value: "" })}
            />
            <TextField
              label={percent ? "Desconto (%)" : "Desconto (R$)"}
              name="value"
              data-field="value"
              inputMode={percent ? "numeric" : "decimal"}
              autoComplete="off"
              placeholder={percent ? "10" : "50,00"}
              value={values.value}
              onChange={(event) => update({ value: event.target.value })}
              error={errors.value}
              hint={
                percent
                  ? `De 1% a ${MAX_COUPON_PERCENT}%.`
                  : "Valor tirado do preço. A conta nunca sai por menos de R$ 5,00."
              }
            />
            <DiscountPreview values={values} />
            <ToggleField
              label="Cupom ativo"
              description="Desligado, o cupom para de valer na hora, sem precisar apagar."
              checked={values.active}
              onChange={(active) => update({ active })}
            />
          </FormSection>

          <FormSection title="Limites (opcional)" description="Deixe em branco para o cupom valer sempre e sem limite de usos.">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Começa a valer em"
                name="startsAt"
                data-field="startsAt"
                type="date"
                value={values.startsOn}
                onChange={(event) => update({ startsOn: event.target.value })}
                error={errors.startsAt}
              />
              <TextField
                label="Vale até (inclusive)"
                name="endsAt"
                data-field="endsAt"
                type="date"
                value={values.endsOn}
                onChange={(event) => update({ endsOn: event.target.value })}
                error={errors.endsAt}
              />
            </div>
            <TextField
              label="Limite de usos"
              name="maxUses"
              data-field="maxUses"
              inputMode="numeric"
              autoComplete="off"
              placeholder="Sem limite"
              value={values.maxUses}
              onChange={(event) => update({ maxUses: event.target.value.replace(/\D/g, "") })}
              error={errors.maxUses}
              hint="Quantos pedidos podem usar o cupom. Pedido cancelado devolve o uso."
            />
            <TextAreaField
              label="Anotações"
              name="notes"
              data-field="notes"
              rows={2}
              maxLength={500}
              placeholder="Ex.: cupom da live de sexta, parceria com @fulano…"
              value={values.notes}
              onChange={(event) => update({ notes: event.target.value })}
              error={errors.notes}
            />
          </FormSection>
        </div>

        <FormFooter
          submitLabel={coupon ? "Salvar alterações" : "Criar cupom"}
          mobileSubmitLabel={coupon ? "Salvar" : "Criar cupom"}
          pending={save.pending}
          onCancel={() => navigate(LIST_PATH)}
          onDelete={coupon ? () => setConfirmOpen(true) : undefined}
          deleteLabel="Apagar cupom"
          errors={[Object.keys(errors).length > 0 ? "Revise os campos marcados em vermelho." : null, save.error?.message, remove.error?.message]}
        />
      </form>

      {coupon && (
        <ConfirmDialog
          open={confirmOpen}
          title="Apagar este cupom?"
          description={
            <>
              <strong className="text-white">{coupon.code}</strong> para de valer no checkout. Os pedidos que já usaram continuam com o
              desconto registrado. Para só pausar, desligue “Cupom ativo”.
            </>
          }
          confirmLabel="Apagar"
          pending={remove.pending}
          onConfirm={() => void onDelete()}
          onClose={() => setConfirmOpen(false)}
        />
      )}
    </>
  );
}

export default function CouponEditorPage() {
  const { id } = useParams();
  const coupon = useAdminQuery((deps) => (id ? findCoupon(deps, id) : Promise.resolve(null)), id ?? "new");

  if (coupon.status === "loading") return <LoadingBlock />;
  if (coupon.status === "error") return <ErrorState message={coupon.error.message} onRetry={coupon.reload} />;
  if (id && !coupon.data) {
    return (
      <EmptyState
        title="Cupom não encontrado"
        description="Ele pode ter sido apagado."
        action={
          <Link to={LIST_PATH} className="text-sm text-electric-soft underline-offset-4 hover:underline">
            Voltar para os cupons
          </Link>
        }
      />
    );
  }
  return <CouponEditor key={id ?? "new"} coupon={coupon.data} />;
}
