import { Globe2 } from "lucide-react";
import type { Account } from "@/domain/account";
import { maskDocumentInput } from "@/domain/brazil";
import { LEAD_SOURCE_LABEL, orderCheckoutSources, type LeadSource } from "@/domain/lead";
import { REFERRED_BY_MAX_LENGTH } from "@/domain/referral";
import { fillCountry, joinCountryNames, residenceNoticesFor } from "@/domain/residence-notice";
import { SelectInput, TextField } from "@/ui/components/form/Fields";
import { formatWhatsappInput, sourceOf, type CheckoutField, type CheckoutValues } from "@/ui/hooks/useCheckoutForm";
import { cn } from "@/ui/lib/cn";
import { editable } from "@/ui/lib/site-preview";
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
  /** Contas do pedido: o país de cada uma decide o aviso de proxy e emulador. */
  accounts: readonly Account[];
  values: CheckoutValues;
  errors: Partial<Record<CheckoutField, string>>;
  setField: <K extends CheckoutField>(field: K, value: CheckoutValues[K]) => void;
  setAbroad: (abroad: boolean) => void;
}

const RESIDENCE_OPTIONS = [
  { abroad: false, label: "No Brasil" },
  { abroad: true, label: "Fora do Brasil" },
] as const;

function ResidenceNotice({ title, text, titlePath, textPath }: { title: string; text: string; titlePath: string; textPath: string }) {
  return (
    <div role="note" className="mt-3 flex gap-3 rounded-2xl border border-electric/35 bg-electric/[0.07] p-4 text-left">
      <Globe2 aria-hidden className="mt-0.5 size-5 shrink-0 text-electric" />
      <div>
        <p {...editable(titlePath)} className="text-sm font-semibold text-white">
          {title}
        </p>
        <p {...editable(textPath)} className="mt-1 text-sm leading-relaxed text-fog">
          {text}
        </p>
      </div>
    </div>
  );
}

interface ResidenceChoiceProps {
  abroad: boolean;
  accounts: readonly Account[];
  onChange: (abroad: boolean) => void;
}

/**
 * Onde a pessoa mora muda o formato do WhatsApp. O aviso de proxy e emulador cruza isso com o país da conta:
 * quem mora fora levando conta do Brasil e qualquer um levando conta de outro país (inclusive quem mora no Brasil).
 */
function ResidenceChoice({ abroad, accounts, onChange }: ResidenceChoiceProps) {
  const { abroadTitle, abroadNotice, foreignTitle, foreignNotice } = useSiteContent().checkoutPage;
  const notices = residenceNoticesFor(abroad, accounts);
  const foreignCountry = joinCountryNames(notices.foreignCountries);
  return (
    <div>
      <p id="checkout-residencia" className="text-sm font-medium text-fog">
        Onde você mora?
      </p>
      <div role="radiogroup" aria-labelledby="checkout-residencia" className="mt-2 grid grid-cols-2 gap-2 sm:max-w-sm">
        {RESIDENCE_OPTIONS.map((option) => (
          <label
            key={option.label}
            className={cn(
              "cursor-pointer rounded-full border px-4 py-2.5 text-center text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-electric",
              abroad === option.abroad ? "border-electric bg-electric/15 font-semibold text-white" : "border-line-strong text-mist hover:text-white",
            )}
          >
            <input
              type="radio"
              name="abroad"
              value={option.abroad ? "yes" : "no"}
              checked={abroad === option.abroad}
              onChange={() => onChange(option.abroad)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
      {notices.abroad && (
        <ResidenceNotice title={abroadTitle} text={abroadNotice} titlePath="checkoutPage.abroadTitle" textPath="checkoutPage.abroadNotice" />
      )}
      {foreignCountry && (
        <ResidenceNotice
          title={fillCountry(foreignTitle, foreignCountry)}
          text={fillCountry(foreignNotice, foreignCountry)}
          titlePath="checkoutPage.foreignTitle"
          textPath="checkoutPage.foreignNotice"
        />
      )}
    </div>
  );
}

/** O mínimo para entregar e dar garantia: nome, WhatsApp, CPF/CNPJ e como conheceu a loja. */
export function CheckoutProfileFields({ accounts, values, errors, setField, setAbroad }: CheckoutProfileFieldsProps) {
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
      <ResidenceChoice abroad={values.abroad} accounts={accounts} onChange={setAbroad} />
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
        <TextField
          label={values.abroad ? "WhatsApp com o código do país" : "WhatsApp com DDD"}
          name="whatsapp"
          type="tel"
          inputMode="tel"
          autoComplete={values.abroad ? "tel" : "tel-national"}
          placeholder={values.abroad ? "+351 912 345 678" : "(11) 91234-5678"}
          value={values.whatsapp}
          onChange={(event) => setField("whatsapp", formatWhatsappInput(event.target.value, values.abroad))}
          error={errors.whatsapp}
          hint="É por aqui que você recebe o acesso da conta."
        />
        <TextField
          label="Confirme o WhatsApp"
          name="whatsappConfirm"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder={values.abroad ? "+351 912 345 678" : "(11) 91234-5678"}
          value={values.whatsappConfirm}
          onChange={(event) => setField("whatsappConfirm", formatWhatsappInput(event.target.value, values.abroad))}
          error={errors.whatsappConfirm}
          hint="Digite de novo para não ter erro na entrega."
        />
      </div>
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
