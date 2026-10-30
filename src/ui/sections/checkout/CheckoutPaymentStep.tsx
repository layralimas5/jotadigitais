import { CreditCard, QrCode, Split } from "lucide-react";
import { Link } from "react-router-dom";
import { formatBRL, parseMoneyToCents, type Cents } from "@/domain/money";
import { MAX_CARD_INSTALLMENTS } from "@/domain/order";
import { ChoiceCard, SelectInput, TextField } from "@/ui/components/form/Fields";
import type { CheckoutField, CheckoutValues, SplitKind } from "@/ui/hooks/useCheckoutForm";
import { cn } from "@/ui/lib/cn";

interface CheckoutPaymentStepProps {
  total: Cents;
  /** Pix só aparece com a chave do Jota configurada no painel. */
  pixEnabled: boolean;
  values: CheckoutValues;
  errors: Partial<Record<CheckoutField, string>>;
  setField: <K extends CheckoutField>(field: K, value: CheckoutValues[K]) => void;
}

const SPLIT_KINDS: readonly { kind: SplitKind; label: string; needsPix: boolean }[] = [
  { kind: "two_cards", label: "Dois cartões", needsPix: false },
  { kind: "card_pix", label: "Cartão + Pix", needsPix: true },
];

/** O valor de cada parcela com juros só a InfinitePay calcula: aqui aparece o total só no 1x. */
const installmentOptions = (total: Cents) => [
  { value: "", label: "Escolha" },
  ...Array.from({ length: MAX_CARD_INSTALLMENTS }, (_, index) => {
    const count = index + 1;
    return { value: String(count), label: count === 1 ? `1x de ${formatBRL(total)} (à vista)` : `${count}x (com juros da operadora)` };
  }),
];

function InstallmentsField({ total, values, errors, setField }: CheckoutPaymentStepProps) {
  return (
    <SelectInput
      className="mt-4"
      label="Em quantas vezes?"
      name="installments"
      hint="O valor de cada parcela aparece na tela de pagamento da InfinitePay. Lá, escolha o mesmo número de vezes."
      options={installmentOptions(total)}
      value={values.installments}
      onChange={(event) => setField("installments", event.target.value)}
      error={errors.installments}
    />
  );
}

function SplitFields({ total, pixEnabled, values, errors, setField }: CheckoutPaymentStepProps) {
  const kinds = SPLIT_KINDS.filter((option) => pixEnabled || !option.needsPix);
  const kind = kinds.some((option) => option.kind === values.splitKind) ? values.splitKind : "two_cards";
  const first = parseMoneyToCents(values.firstPart);
  const rest = Number.isNaN(first) ? null : total - first;
  const secondLabel = kind === "two_cards" ? "No segundo cartão" : "No Pix";

  return (
    <div className="mt-4 space-y-4 rounded-2xl border border-line bg-ink/40 p-4 sm:p-5">
      {kinds.length > 1 && (
        <div role="radiogroup" aria-label="Como dividir" className="grid grid-cols-2 gap-2">
          {kinds.map((option) => (
            <label
              key={option.kind}
              className={cn(
                "cursor-pointer rounded-full border px-4 py-2 text-center text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-electric",
                kind === option.kind ? "border-electric bg-electric/15 text-white" : "border-line-strong text-mist hover:text-white",
              )}
            >
              <input
                type="radio"
                name="splitKind"
                value={option.kind}
                checked={kind === option.kind}
                onChange={() => setField("splitKind", option.kind)}
                className="sr-only"
              />
              {option.label}
            </label>
          ))}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
        <TextField
          label="No primeiro cartão (R$)"
          name="firstPart"
          inputMode="decimal"
          autoComplete="off"
          value={values.firstPart}
          onChange={(event) => setField("firstPart", event.target.value)}
          error={errors.firstPart}
        />
        <div aria-live="polite">
          <p className="text-sm font-medium text-fog">{secondLabel}</p>
          <p className="mt-2 flex h-12 items-center font-display text-xl font-semibold text-white tabular-nums">
            {rest !== null && rest > 0 ? formatBRL(rest) : "—"}
          </p>
        </div>
      </div>
      <p className="text-xs text-mist">
        Cada parte é paga separada, na página do pedido. A conta fica reservada até as duas serem confirmadas.
      </p>
    </div>
  );
}

/** Forma de pagamento: Pix (C6 Bank), cartão (InfinitePay) ou dividido em duas partes. */
export function CheckoutPaymentStep(props: CheckoutPaymentStepProps) {
  const { total, pixEnabled, values, errors, setField } = props;
  const choose = (choice: CheckoutValues["paymentChoice"]) => setField("paymentChoice", choice);

  return (
    <>
      <fieldset>
        <legend className="font-display text-lg font-semibold text-white">Pagamento</legend>
        <div
          className={cn("mt-5 grid gap-3", pixEnabled ? "sm:grid-cols-3" : "sm:grid-cols-2")}
          aria-describedby={errors.paymentChoice ? "payment-error" : undefined}
        >
          {pixEnabled && (
            <ChoiceCard
              name="paymentChoice"
              value="pix"
              checked={values.paymentChoice === "pix"}
              onChange={() => choose("pix")}
              title="Pix"
              description={`${formatBRL(total)} à vista`}
              icon={<QrCode className="size-5" />}
            />
          )}
          <ChoiceCard
            name="paymentChoice"
            value="card"
            checked={values.paymentChoice === "card"}
            onChange={() => choose("card")}
            title="Cartão de crédito"
            description={`Em até ${MAX_CARD_INSTALLMENTS}x com juros da operadora`}
            icon={<CreditCard className="size-5" />}
          />
          <ChoiceCard
            name="paymentChoice"
            value="split"
            checked={values.paymentChoice === "split"}
            onChange={() => choose("split")}
            title="Dividir em dois"
            description={pixEnabled ? "Dois cartões ou cartão + Pix" : "Em dois cartões diferentes"}
            icon={<Split className="size-5" />}
          />
        </div>
        {errors.paymentChoice && (
          <p id="payment-error" className="mt-2 text-xs font-medium text-[#ff7a7a]">
            {errors.paymentChoice}
          </p>
        )}
        {values.paymentChoice === "card" && <InstallmentsField {...props} />}
        {values.paymentChoice === "split" && <SplitFields {...props} />}
      </fieldset>

      <div>
        <label className="flex cursor-pointer items-start gap-3 text-sm text-fog">
          <input
            type="checkbox"
            name="acceptedTerms"
            checked={values.acceptedTerms}
            onChange={(event) => setField("acceptedTerms", event.target.checked)}
            aria-invalid={errors.acceptedTerms ? true : undefined}
            aria-describedby={errors.acceptedTerms ? "terms-error" : undefined}
            className="mt-0.5 size-5 shrink-0 accent-electric"
          />
          <span>
            Li e aceito os{" "}
            <Link to="/termos-de-uso" target="_blank" className="text-electric-soft underline underline-offset-4">
              Termos de Uso<span className="sr-only"> (abre em outra aba)</span>
            </Link>{" "}
            e a{" "}
            <Link to="/politica-de-privacidade" target="_blank" className="text-electric-soft underline underline-offset-4">
              Política de Privacidade<span className="sr-only"> (abre em outra aba)</span>
            </Link>
            , incluindo as condições de entrega, garantia e reembolso, e declaro ter 18 anos ou mais.
          </span>
        </label>
        {errors.acceptedTerms && (
          <p id="terms-error" className="mt-2 text-xs font-medium text-[#ff7a7a]">
            {errors.acceptedTerms}
          </p>
        )}
      </div>
    </>
  );
}
