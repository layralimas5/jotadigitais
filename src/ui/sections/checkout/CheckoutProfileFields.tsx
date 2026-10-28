import { maskDocumentInput } from "@/domain/brazil";
import { LEAD_SOURCE_LABEL, type LeadSource } from "@/domain/lead";
import { REFERRED_BY_MAX_LENGTH } from "@/domain/referral";
import { SelectInput, TextField } from "@/ui/components/form/Fields";
import { formatWhatsapp, type CheckoutField, type CheckoutValues } from "@/ui/hooks/useCheckoutForm";

/** Ordem pensada para quem compra: redes primeiro, indicação e "outro" no fim. */
const CHECKOUT_SOURCES: readonly LeadSource[] = ["instagram", "tiktok", "youtube", "google", "whatsapp", "referral", "other"];

const SOURCE_OPTIONS = [
  { value: "", label: "Escolha" },
  ...CHECKOUT_SOURCES.map((source) => ({ value: source, label: LEAD_SOURCE_LABEL[source] })),
];

interface CheckoutProfileFieldsProps {
  values: CheckoutValues;
  errors: Partial<Record<CheckoutField, string>>;
  setField: <K extends CheckoutField>(field: K, value: CheckoutValues[K]) => void;
}

/** O mínimo para entregar e dar garantia: nome, WhatsApp, CPF/CNPJ e como conheceu a loja. */
export function CheckoutProfileFields({ values, errors, setField }: CheckoutProfileFieldsProps) {
  return (
    <fieldset className="space-y-4 sm:space-y-5">
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
          label="Como você conheceu a Jota Digitais?"
          name="source"
          options={SOURCE_OPTIONS}
          value={values.source}
          onChange={(event) => setField("source", event.target.value as CheckoutValues["source"])}
          error={errors.source}
        />
        {values.source === "referral" && (
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
