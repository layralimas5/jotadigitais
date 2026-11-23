import { useState } from "react";
import { saveWhatsAppFollowUps } from "@/application/admin-use-cases";
import {
  AFTER_SALE_DAY_OPTIONS,
  REMINDER_MINUTE_OPTIONS,
  afterSaleText,
  reminderText,
  type WhatsAppFollowUps,
  type WhatsAppSettings,
} from "@/domain/whatsapp";
import { Button } from "@/ui/components/Button";
import { InlineError } from "../components/AdminUi";
import { SelectField, ToggleField } from "../components/FormControls";
import { WhatsAppBubble } from "../delivery/WhatsAppBubble";
import { useMutation } from "../hooks";
import { useToast } from "../toast";

const REMINDER_PREVIEW = reminderText({
  name: "Bruna",
  orderCode: "JD-ABC123",
  accounts: "@conta.exemplo",
  until: "14:30",
  link: "jotadigitais.com.br/pedido/JD-ABC123",
});

const AFTER_SALE_PREVIEW = afterSaleText({ name: "Bruna", accounts: "@conta.exemplo" });

const minuteOptions = REMINDER_MINUTE_OPTIONS.map((value) => ({ value: String(value), label: `${value} minutos antes de vencer` }));
const dayOptions = AFTER_SALE_DAY_OPTIONS.map((value) => ({ value: String(value), label: value === 1 ? "1 dia depois da entrega" : `${value} dias depois da entrega` }));

const sameFollowUps = (a: WhatsAppFollowUps, b: WhatsAppFollowUps) =>
  a.paymentReminder === b.paymentReminder && a.reminderMinutes === b.reminderMinutes && a.afterSale === b.afterSale && a.afterSaleDays === b.afterSaleDays;

interface FollowUpCardProps {
  title: string;
  toggleLabel: string;
  toggleDescription: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  selectLabel: string;
  selectValue: number;
  options: readonly { value: string; label: string }[];
  onSelect: (value: number) => void;
  preview: string;
}

function FollowUpCard({ title, toggleLabel, toggleDescription, enabled, onToggle, selectLabel, selectValue, options, onSelect, preview }: FollowUpCardProps) {
  return (
    <article className="space-y-4 rounded-3xl border border-line bg-surface/60 p-5 sm:p-6">
      <h3 className="font-display text-sm font-semibold text-white">{title}</h3>
      <ToggleField label={toggleLabel} description={toggleDescription} checked={enabled} onChange={onToggle} />
      <SelectField
        label={selectLabel}
        value={String(selectValue)}
        options={options}
        disabled={!enabled}
        onChange={(event) => onSelect(Number(event.target.value))}
      />
      <div className="space-y-2">
        <p className="text-xs text-mist">Mensagem que o cliente recebe (o texto do modelo aprovado pela Meta):</p>
        <WhatsAppBubble text={preview} />
      </div>
    </article>
  );
}

/** Lembrete de pedido não pago e pós-venda: liga, escolhe quando e vê o texto. Salva os dois de uma vez. */
export function WhatsAppFollowUpsSection({ initial }: { initial: WhatsAppSettings }) {
  const toast = useToast();
  const [saved, setSaved] = useState(initial.followUps);
  const [draft, setDraft] = useState(initial.followUps);
  const save = useMutation(saveWhatsAppFollowUps);
  const dirty = !sameFollowUps(saved, draft);
  const update = (fields: Partial<WhatsAppFollowUps>) => setDraft((current) => ({ ...current, ...fields }));

  const submit = async () => {
    const result = await save.run(draft);
    if (!result) return;
    setSaved(result.followUps);
    setDraft(result.followUps);
    toast.show("Lembretes salvos.");
  };

  return (
    <section aria-labelledby="whatsapp-followups-title" className="space-y-4">
      <div>
        <h2 id="whatsapp-followups-title" className="font-display text-base font-semibold text-white">
          Lembretes automáticos
        </h2>
        <p className="mt-1 text-sm text-mist">
          Saem sozinhos, uma vez por pedido. Quem escreveu “parar” no WhatsApp não recebe. No modo teste, só aparecem em Últimos envios.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <FollowUpCard
          title="Pedido não pago"
          toggleLabel="Lembrar antes de a reserva vencer"
          toggleDescription="Para quem fechou o pedido e ainda não pagou."
          enabled={draft.paymentReminder}
          onToggle={(paymentReminder) => update({ paymentReminder })}
          selectLabel="Quando"
          selectValue={draft.reminderMinutes}
          options={minuteOptions}
          onSelect={(reminderMinutes) => update({ reminderMinutes })}
          preview={REMINDER_PREVIEW}
        />
        <FollowUpCard
          title="Pós-venda"
          toggleLabel="Perguntar se deu tudo certo"
          toggleDescription="Para quem já recebeu a conta. A resposta cai nas conversas."
          enabled={draft.afterSale}
          onToggle={(afterSale) => update({ afterSale })}
          selectLabel="Quando"
          selectValue={draft.afterSaleDays}
          options={dayOptions}
          onSelect={(afterSaleDays) => update({ afterSaleDays })}
          preview={AFTER_SALE_PREVIEW}
        />
      </div>
      {save.error && <InlineError message={save.error.message} />}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" disabled={!dirty || save.pending} onClick={() => setDraft(saved)}>
          Descartar
        </Button>
        <Button type="button" disabled={!dirty || save.pending} onClick={() => void submit()}>
          {save.pending ? "Salvando…" : "Salvar lembretes"}
        </Button>
      </div>
    </section>
  );
}
