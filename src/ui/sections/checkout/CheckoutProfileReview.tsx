import { Pencil, UserCheck } from "lucide-react";
import { formatDocument } from "@/domain/brazil";
import { LEAD_SOURCE_LABEL } from "@/domain/lead";
import type { CheckoutValues } from "@/ui/hooks/useCheckoutForm";

const onlyDigits = (value: string) => value.replace(/\D/g, "");

function formatBirthDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return day && month && year ? `${day}/${month}/${year}` : iso;
}

function sourceLabel({ source, referredBy }: CheckoutValues): string {
  if (!source) return "";
  if (source === "referral") return `Indicação de ${referredBy.trim()}`;
  return LEAD_SOURCE_LABEL[source];
}

/** Ficha já conferida, no topo do passo de pagamento, com atalho para corrigir. */
export function CheckoutProfileReview({ values, onEdit }: { values: CheckoutValues; onEdit: () => void }) {
  const rows = [
    { label: "Nome", value: values.name },
    { label: "CPF/CNPJ", value: formatDocument(onlyDigits(values.document)) },
    { label: "Nascimento", value: formatBirthDate(values.birthDate) },
    { label: "WhatsApp", value: values.whatsapp },
    { label: "Cidade", value: `${values.city.trim()} / ${values.state}` },
    { label: "Como conheceu", value: sourceLabel(values) },
  ];
  return (
    <section aria-labelledby="ficha-title" className="rounded-3xl border border-line bg-surface/60 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="ficha-title" className="flex items-center gap-2 font-display text-base font-semibold text-white">
          <UserCheck aria-hidden className="size-4 text-electric" /> Sua ficha
        </h2>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-electric-soft hover:bg-white/[0.05]"
        >
          <Pencil aria-hidden className="size-3.5" /> Editar
        </button>
      </div>
      <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="min-w-0">
            <dt className="text-xs text-mist">{row.label}</dt>
            <dd className="truncate text-fog">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
