import { BRAZIL_STATES, maskDocumentInput } from "@/domain/brazil";
import { LEAD_SOURCE_LABEL, type LeadSource } from "@/domain/lead";
import { REFERRED_BY_MAX_LENGTH } from "@/domain/referral";
import { SelectInput, TextField } from "@/ui/components/form/Fields";
import { formatWhatsapp, type CheckoutField, type CheckoutValues } from "@/ui/hooks/useCheckoutForm";

const STATE_OPTIONS = [{ value: "", label: "UF" }, ...BRAZIL_STATES.map((state) => ({ value: state, label: state }))];

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

/** Ficha completa de quem compra: identificação, contato e localização. */
export function CheckoutProfileFields({ values, errors, setField }: CheckoutProfileFieldsProps) {
  return (
    <fieldset className="space-y-4 sm:space-y-5">
      <legend className="font-display text-lg font-semibold text-white">Sua ficha</legend>
      <p className="-mt-1 text-sm text-mist">
        Preencha uma vez: é com esses dados que a conta fica no seu nome e a garantia vale.
      </p>
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
          label="CPF ou CNPJ"
          name="document"
          inputMode="numeric"
          autoComplete="off"
          placeholder="000.000.000-00"
          maxLength={18}
          value={values.document}
          onChange={(event) => setField("document", maskDocumentInput(event.target.value))}
          error={errors.document}
        />
        <TextField
          label="Data de nascimento"
          name="birthDate"
          type="date"
          autoComplete="bday"
          value={values.birthDate}
          onChange={(event) => setField("birthDate", event.target.value)}
          error={errors.birthDate}
          className="[&_input]:[color-scheme:dark]"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
        <TextField
          label="E-mail"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={values.email}
          onChange={(event) => setField("email", event.target.value)}
          error={errors.email}
          hint="É aqui que você recebe o acesso."
        />
        <TextField
          label="Confirme o e-mail"
          name="emailConfirmation"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={values.emailConfirmation}
          onChange={(event) => setField("emailConfirmation", event.target.value)}
          error={errors.emailConfirmation}
        />
      </div>
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
          hint="Para o suporte falar com você."
        />
        <TextField
          label="Instagram (opcional)"
          name="instagram"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="@seuperfil"
          maxLength={31}
          value={values.instagram}
          onChange={(event) => setField("instagram", event.target.value)}
          error={errors.instagram}
        />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-4 sm:gap-5">
        <TextField
          label="Cidade"
          name="city"
          autoComplete="address-level2"
          maxLength={60}
          value={values.city}
          onChange={(event) => setField("city", event.target.value)}
          error={errors.city}
        />
        <SelectInput
          label="Estado"
          name="state"
          autoComplete="address-level1"
          options={STATE_OPTIONS}
          value={values.state}
          onChange={(event) => setField("state", event.target.value as CheckoutValues["state"])}
          error={errors.state}
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
