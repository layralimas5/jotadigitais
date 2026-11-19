import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { getWhatsAppAi, listWhatsAppFaq, saveWhatsAppAiSetup } from "@/application/admin-use-cases";
import { fieldErrorsOf, whatsAppAiSettingsSchema, whatsAppFaqSchema } from "@/application/schemas";
import { AI_LIMITS, WEEKDAYS, type AiDraft, type AiSchedule, type WhatsAppAiSettings, type WhatsAppFaq } from "@/domain/whatsapp";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/form/Fields";
import { ErrorState } from "@/ui/components/StateViews";
import { cn } from "@/ui/lib/cn";
import { FormSection, InlineError, LoadingBlock } from "../components/AdminUi";
import { SegmentedField, TextAreaField } from "../components/FormControls";
import { useAdminQuery, useMutation } from "../hooks";
import { useToast } from "../toast";
import { TEACH_ANSWER_PARAM, TEACH_QUESTION_PARAM } from "../whatsapp/links";
import { AiSimulator } from "./AiSimulator";

interface FaqRow {
  /** Chave da tela: o id salvo ou um provisório. */
  key: string;
  id?: string;
  question: string;
  answer: string;
}

const toRows = (faq: readonly WhatsAppFaq[]): FaqRow[] => faq.map((item) => ({ key: item.id, ...item }));

const SCHEDULE_OPTIONS: readonly { value: AiSchedule; label: string }[] = [
  { value: "always", label: "24 horas" },
  { value: "off_hours", label: "Só fora do horário" },
];

const INSTRUCTIONS_PLACEHOLDER = [
  "Ex.:",
  "- Sempre ofereça primeiro as contas de TikTok com Shop completo.",
  "- Se perguntarem por conta do exterior, diga que chegam toda semana.",
  "- Não fale de prazo de entrega de contas encomendadas.",
].join("\n");

const parseNumbers = (text: string) =>
  text
    .split(/[\n,;]+/)
    .map((line) => line.replace(/\D/g, ""))
    .filter(Boolean);

function FaqItem({
  row,
  index,
  total,
  errors,
  autoFocus,
  onChange,
  onMove,
  onRemove,
}: {
  row: FaqRow;
  index: number;
  total: number;
  errors: Record<string, string>;
  autoFocus: boolean;
  onChange: (row: FaqRow) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!autoFocus) return;
    ref.current?.scrollIntoView({ block: "center" });
    ref.current?.querySelector("input")?.focus();
  }, [autoFocus]);

  return (
    <li>
      <div ref={ref} className="rounded-2xl border border-line-strong bg-ink/60 p-4">
        <div className="flex items-start gap-2">
          <TextField
            label={`Pergunta ${index + 1}`}
            value={row.question}
            maxLength={AI_LIMITS.question}
            error={errors[`${index}.question`]}
            onChange={(event) => onChange({ ...row, question: event.target.value })}
            className="min-w-0 flex-1"
          />
          <div className="mt-7 flex shrink-0 items-center">
            <Button type="button" variant="ghost" className="size-10 px-0" disabled={index === 0} onClick={() => onMove(-1)} aria-label={`Subir a pergunta ${index + 1}`}>
              <ArrowUp aria-hidden className="size-4" />
            </Button>
            <Button type="button" variant="ghost" className="size-10 px-0" disabled={index === total - 1} onClick={() => onMove(1)} aria-label={`Descer a pergunta ${index + 1}`}>
              <ArrowDown aria-hidden className="size-4" />
            </Button>
            <Button type="button" variant="ghost" className="size-10 px-0 hover:text-[#ff7a7a]" onClick={onRemove} aria-label={`Apagar a pergunta ${index + 1}`}>
              <Trash2 aria-hidden className="size-4" />
            </Button>
          </div>
        </div>
        <TextAreaField
          label="Resposta"
          value={row.answer}
          maxLength={AI_LIMITS.answer}
          error={errors[`${index}.answer`]}
          onChange={(event) => onChange({ ...row, answer: event.target.value })}
          className="mt-3"
        />
      </div>
    </li>
  );
}

function DaysPicker({ value, onChange, error }: { value: readonly number[]; onChange: (days: number[]) => void; error?: string }) {
  const toggle = (day: number) => onChange(value.includes(day) ? value.filter((item) => item !== day) : [...value, day].sort());
  return (
    <fieldset>
      <legend className="text-sm font-medium text-fog">Dias de atendimento da loja</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {WEEKDAYS.map((day) => {
          const on = value.includes(day.value);
          return (
            <button
              key={day.value}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(day.value)}
              className={cn(
                "h-10 min-w-12 rounded-full border px-3 text-sm font-medium transition-colors",
                on ? "border-electric bg-electric/15 text-white" : "border-line-strong text-mist hover:text-white",
              )}
            >
              {day.short}
            </button>
          );
        })}
      </div>
      {error && <p className="mt-1.5 text-xs font-medium text-[#ff7a7a]">{error}</p>}
    </fieldset>
  );
}

function AiSetupForm({
  initial,
  initialFaq,
  onSaved,
}: {
  initial: WhatsAppAiSettings;
  initialFaq: readonly WhatsAppFaq[];
  onSaved: (settings: WhatsAppAiSettings) => void;
}) {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [settings, setSettings] = useState(initial);
  const [rows, setRows] = useState<FaqRow[]>(() => toRows(initialFaq));
  const [numbersText, setNumbersText] = useState(initial.ignoredNumbers.join("\n"));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [faqErrors, setFaqErrors] = useState<Record<string, string>>({});
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const save = useMutation(saveWhatsAppAiSetup);

  // A faixa de cima liga e desliga a IA: o formulário acompanha para não desfazer ao salvar.
  useEffect(() => setSettings((current) => ({ ...current, enabled: initial.enabled })), [initial.enabled]);

  // "Ensinar essa resposta" na aba WhatsApp chega aqui com a pergunta e a resposta preenchidas.
  // O mesmo link entra uma vez só, mesmo com o efeito rodando de novo antes de os parâmetros saírem do endereço.
  const taught = useRef<string | null>(null);
  useEffect(() => {
    const question = params.get(TEACH_QUESTION_PARAM);
    const answer = params.get(TEACH_ANSWER_PARAM);
    if (question === null && answer === null) return;
    const signature = `${question}\n${answer}`;
    if (taught.current === signature) return;
    taught.current = signature;
    const key = `new-${crypto.randomUUID()}`;
    setRows((current) => [...current, { key, question: question ?? "", answer: answer ?? "" }]);
    setFocusKey(key);
    const next = new URLSearchParams(params);
    next.delete(TEACH_QUESTION_PARAM);
    next.delete(TEACH_ANSWER_PARAM);
    setParams(next, { replace: true });
    toast.show("Pergunta nova adicionada no fim da lista. Ajuste o texto e salve.");
  }, [params, setParams, toast]);

  const draft: AiDraft = useMemo(
    () => ({
      greeting: settings.greeting.trim() || initial.greeting,
      tone: settings.tone.trim() || initial.tone,
      instructions: settings.instructions,
      faq: rows.filter((row) => row.question.trim().length >= 3 && row.answer.trim()).map(({ question, answer }) => ({ question: question.trim(), answer: answer.trim() })),
    }),
    [settings.greeting, settings.tone, settings.instructions, rows, initial.greeting, initial.tone],
  );

  const set = <K extends keyof WhatsAppAiSettings>(key: K, value: WhatsAppAiSettings[K]) => setSettings((current) => ({ ...current, [key]: value }));

  const updateRow = (key: string, row: FaqRow) => setRows((current) => current.map((item) => (item.key === key ? row : item)));
  const moveRow = (index: number, delta: -1 | 1) =>
    setRows((current) => {
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item!);
      return next;
    });
  const addRow = () => {
    const key = `new-${crypto.randomUUID()}`;
    setRows((current) => [...current, { key, question: "", answer: "" }]);
    setFocusKey(key);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedSettings = whatsAppAiSettingsSchema.safeParse({ ...settings, ignoredNumbers: parseNumbers(numbersText) });
    const parsedFaq = whatsAppFaqSchema.safeParse(rows.map(({ id, question, answer }) => ({ id, question, answer })));
    setErrors(parsedSettings.success ? {} : fieldErrorsOf(parsedSettings.error));
    setFaqErrors(parsedFaq.success ? {} : fieldErrorsOf(parsedFaq.error));
    if (!parsedSettings.success || !parsedFaq.success) {
      toast.show("Revise os campos marcados em vermelho.", "error");
      return;
    }
    const saved = await save.run(parsedSettings.data, parsedFaq.data);
    if (!saved) {
      toast.show("Não foi possível salvar a IA.", "error");
      return;
    }
    setSettings(saved.settings);
    setRows(toRows(saved.faq));
    setNumbersText(saved.settings.ignoredNumbers.join("\n"));
    onSaved(saved.settings);
    toast.show("IA salva. As próximas conversas já usam a configuração nova.");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)] lg:items-start">
      <form noValidate onSubmit={onSubmit} aria-busy={save.pending} className="min-w-0 space-y-6">
        <FormSection title="Como a IA fala" description="O jeito de atender. A IA segue isso em toda conversa.">
          <TextAreaField
            label="Boas-vindas no primeiro contato"
            hint="A IA usa a ideia desta mensagem com as palavras dela, já respondendo o que o cliente perguntou."
            value={settings.greeting}
            maxLength={AI_LIMITS.greeting}
            error={errors.greeting}
            onChange={(event) => set("greeting", event.target.value)}
          />
          <TextAreaField
            label="Tom de voz"
            hint="Como você quer soar. Ex.: simpático e direto, sem formalidade."
            value={settings.tone}
            maxLength={AI_LIMITS.tone}
            error={errors.tone}
            onChange={(event) => set("tone", event.target.value)}
            className="mt-4"
          />
          <TextAreaField
            label="Instruções extras (opcional)"
            hint={`Regras da loja que a IA precisa saber. ${settings.instructions.length}/${AI_LIMITS.instructions}`}
            placeholder={INSTRUCTIONS_PLACEHOLDER}
            value={settings.instructions}
            maxLength={AI_LIMITS.instructions}
            error={errors.instructions}
            onChange={(event) => set("instructions", event.target.value)}
            className="mt-4"
          />
          <p className="mt-4 rounded-2xl border border-line bg-ink/50 p-4 text-xs leading-relaxed text-mist">
            Já vem pronto e não precisa escrever: a IA consulta as contas da vitrine em tempo real, a situação do pedido pelo
            código, a garantia e as formas de pagamento. Ela nunca envia senha, diz que é atendimento automático se perguntarem e
            chama você quando o cliente pede desconto, reclama ou quer fechar algo fora do padrão.
          </p>
        </FormSection>

        <FormSection title="Perguntas frequentes" description="Respostas que a IA usa ao pé da letra. Ordem importa: as mais comuns primeiro.">
          {rows.length === 0 ? (
            <p className="text-sm text-mist">Nenhuma pergunta ainda.</p>
          ) : (
            <ol className="space-y-3">
              {rows.map((row, index) => (
                <FaqItem
                  key={row.key}
                  row={row}
                  index={index}
                  total={rows.length}
                  errors={faqErrors}
                  autoFocus={focusKey === row.key}
                  onChange={(next) => updateRow(row.key, next)}
                  onMove={(delta) => moveRow(index, delta)}
                  onRemove={() => setRows((current) => current.filter((item) => item.key !== row.key))}
                />
              ))}
            </ol>
          )}
          <Button type="button" variant="secondary" onClick={addRow} disabled={rows.length >= AI_LIMITS.faq} className="mt-3">
            <Plus aria-hidden className="size-4" /> Adicionar pergunta
          </Button>
        </FormSection>

        <FormSection title="Quando a IA responde" description="Fora disso, a mensagem fica esperando você na aba WhatsApp.">
          <SegmentedField<AiSchedule>
            legend="A IA atende"
            name="ai_schedule"
            value={settings.schedule}
            options={SCHEDULE_OPTIONS}
            onChange={(value) => set("schedule", value)}
          />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <TextField
              label="Loja abre às"
              type="time"
              value={settings.businessStart}
              error={errors.businessStart}
              onChange={(event) => set("businessStart", event.target.value)}
              className="[color-scheme:dark]"
            />
            <TextField
              label="Loja fecha às"
              type="time"
              value={settings.businessEnd}
              error={errors.businessEnd}
              onChange={(event) => set("businessEnd", event.target.value)}
              className="[color-scheme:dark]"
            />
          </div>
          <div className="mt-4">
            <DaysPicker value={settings.businessDays} onChange={(days) => set("businessDays", days)} error={errors.businessDays} />
          </div>
          <p className="mt-3 text-xs text-mist">
            {settings.schedule === "always"
              ? "Com 24 horas, o horário da loja só aparece como referência."
              : "Nesse horário quem responde é você; antes e depois, a IA."}{" "}
            Horário de Brasília.
          </p>
        </FormSection>

        <FormSection title="Números que a IA não responde" description="Família, fornecedores, parceiros. Um por linha, com DDI e DDD.">
          <TextAreaField
            label="Números ignorados"
            placeholder={"5527999998888\n5511988887777"}
            value={numbersText}
            error={Object.entries(errors).find(([key]) => key.startsWith("ignoredNumbers"))?.[1]}
            onChange={(event) => setNumbersText(event.target.value)}
          />
        </FormSection>

        {save.error && <InlineError message={save.error.message} />}
        <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] flex justify-end md:bottom-6">
          <Button type="submit" size="lg" disabled={save.pending} className="max-sm:w-full">
            {save.pending ? "Salvando…" : "Salvar IA"}
          </Button>
        </div>
      </form>

      <div className="lg:sticky lg:top-24">
        <AiSimulator draft={draft} />
      </div>
    </div>
  );
}

export function AiSetupPanel({ enabledOverride, onSaved }: { enabledOverride: boolean | null; onSaved: (settings: WhatsAppAiSettings) => void }) {
  const ai = useAdminQuery(getWhatsAppAi, "whatsapp-ai");
  const faq = useAdminQuery(listWhatsAppFaq, "whatsapp-faq");
  if (ai.status === "loading" || faq.status === "loading") return <LoadingBlock />;
  if (ai.status === "error") return <ErrorState message={ai.error.message} onRetry={ai.reload} />;
  if (faq.status === "error") return <ErrorState message={faq.error.message} onRetry={faq.reload} />;
  const initial = enabledOverride === null ? ai.data : { ...ai.data, enabled: enabledOverride };
  return <AiSetupForm initial={initial} initialFaq={faq.data} onSaved={onSaved} />;
}
