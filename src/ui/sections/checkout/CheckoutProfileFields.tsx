import { maskDocumentInput } from "@/domain/brazil";
import { LEAD_SOURCE_LABEL, orderCheckoutSources, type LeadSource } from "@/domain/lead";
import { REFERRED_BY_MAX_LENGTH } from "@/domain/referral";
import { SelectInput, TextField } from "@/ui/components/form/Fields";
import { formatWhatsapp, sourceOf, type CheckoutField, type CheckoutValues } from "@/ui/hooks/useCheckoutForm";
import { useSiteContent } from "@/ui/hooks/useSiteContent";

/** Opções ligadas no painel (aba Site). Com uma só, ela já vem marcada e o "Escolha" some. */
export function useCheckoutSources() {
  const sources = orderCheckoutSources(useSiteContent().checkoutPage.sources);
  return { sources, defaultSource: sources.length === 1 ? (sources[0] ?? null) : null };
}

const optionsOf = (sources: readonly LeadSource[]) => [
  ...(sources.length === 1 ? [] : [{ value: "", label: "Escolha" }]),
  ...sources.map((source) => ({ value: source, label: LEAD_SOURCE_LABEL[source] })),
];

interface CheckoutProfileFieldsProps {
  values: CheckoutValues;
  errors: Partial<Record<CheckoutField, string>>;
  setField: <K extends CheckoutField>(field: K, value: CheckoutValues[K]) => void;
}

/** O mínimo para entregar e dar garantia: nome, WhatsApp, CPF/CNPJ e como conheceu a loja. */
export function CheckoutProfileFields({ values, errors, setField }: CheckoutProfileFieldsProps) {
  const { sourceQuestion } = useSiteContent().checkoutPage;
  const { sources, defaultSource } = useCheckoutSources();
  const source = sourceOf(values, defaultSource);
  return (
    <fieldset id="checkout-origem" className="space-y-4 sm:space-y-5">
      <legend className="font-display text-lg font-semibold text-white">Seus dados</legend>
      <TextField
        label="Nome completo"
        name="name"
        autoComplete="name"
        autoCapitalize="words"
        value={values.name}
        onChange={(event) => setField("name", event.target.value)}
        error={errors.name}
      />
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
        <TextField
          label="WhatsApp"
          name="whatsapp"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="(11) 91234-5678"
          value={values.whatsapp}
          onChange={(event) => setField("whatsapp", formatWhatsapp(event.target.value))}
          error={errors.whatsapp}
          hint="É por aqui que você recebe o acesso da conta."
        />
        <TextField
          label="CPF ou CNPJ"
          name="document"
          inputMode="numeric"
          autoComplete="off"
          placeholder="000.000.000-00"
          maxLength={18}
          value={values.document}
          onChange={(event) => setField("document", maskDocumentInput(event.target.value))}
          error={errors.document}
          hint="A conta e a garantia ficam no seu nome."
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
        <SelectInput
          label={sourceQuestion}
          name="source"
          options={optionsOf(sources)}
          value={source}
          onChange={(event) => setField("source", event.target.value as CheckoutValues["source"])}
          error={errors.source}
        />
        {source === "referral" && (
          <TextField
            label="Quem indicou?"
            name="referredBy"
            autoCapitalize="words"
            maxLength={REFERRED_BY_MAX_LENGTH}
            placeholder="Nome ou @ de quem indicou"
            value={values.referredBy}
            onChange={(event) => setField("referredBy", event.target.value)}
            error={errors.referredBy}
          />
        )}
      </div>
    </fieldset>
  );
}
