import { Clock, MessageCircle, RotateCcw } from "lucide-react";
import { useId, useRef, useState, type FormEvent } from "react";
import { siteConfig } from "@/app/config";
import { getMessageTemplates, saveMessageTemplates } from "@/application/admin-use-cases";
import { fieldErrorsOf, messageTemplatesSchema } from "@/application/schemas";
import {
  DEFAULT_MESSAGE_TEMPLATES,
  MAX_TEMPLATE_LENGTH,
  MESSAGE_TEMPLATE_INFO,
  MESSAGE_TEMPLATE_KEYS,
  fillTemplate,
  type MessageTemplateKey,
  type MessageTemplates,
  type TemplateValues,
  type TemplateVariable,
} from "@/domain/message-template";
import { Button } from "@/ui/components/Button";
import { ErrorState } from "@/ui/components/StateViews";
import { cn } from "@/ui/lib/cn";
import { InlineError, LoadingBlock, PageHeader } from "../components/AdminUi";
import { useAdminQuery, useMutation } from "../hooks";
import { useToast } from "../toast";

const SAMPLE_VALUES: TemplateValues = {
  nome: "Maria",
  pedido: "JD-7K2M9P",
  conta: "@achadinhos.dabia",
  valor: "R$ 370,00",
  loja: siteConfig.name,
  rede: "TikTok",
  detalhes: ["• 1.259 seguidores", "• 2.123 curtidas", "• TikTok Shop: piloto", "• Monetização: não ativa"].join("\n"),
  link: `${siteConfig.url}/contas/achadinhos-da-bia`,
};

interface TemplateCardProps {
  templateKey: MessageTemplateKey;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}

function TemplateCard({ templateKey, value, error, onChange }: TemplateCardProps) {
  const info = MESSAGE_TEMPLATE_INFO[templateKey];
  const id = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isDefault = value === DEFAULT_MESSAGE_TEMPLATES[templateKey];

  /** Coloca a variável onde está o cursor, sem apagar o que foi escrito. */
  const insert = (variable: TemplateVariable) => {
    const field = textareaRef.current;
    const token = `{${variable}}`;
    if (!field) return onChange(`${value}${token}`);
    const start = field.selectionStart ?? value.length;
    const end = field.selectionEnd ?? value.length;
    onChange(`${value.slice(0, start)}${token}${value.slice(end)}`);
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(start + token.length, start + token.length);
    });
  };

  return (
    <section aria-labelledby={`${id}-title`} className="rounded-3xl border border-line bg-surface/60 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={`${id}-title`} className="font-display text-base font-semibold text-white">
            {info.title}
          </h2>
          <p className="mt-0.5 text-xs text-mist">Usado em: {info.when}</p>
        </div>
        {!isDefault && (
          <button
            type="button"
            onClick={() => onChange(DEFAULT_MESSAGE_TEMPLATES[templateKey])}
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs text-mist hover:text-white"
          >
            <RotateCcw aria-hidden className="size-3.5" /> Voltar ao padrão
          </button>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <label htmlFor={id} className="sr-only">
            Mensagem de {info.title}
          </label>
          <textarea
            ref={textareaRef}
            id={id}
            name={templateKey}
            value={value}
            maxLength={MAX_TEMPLATE_LENGTH}
            aria-invalid={error ? true : undefined}
            aria-describedby={`${id}-vars${error ? ` ${id}-error` : ""}`}
            onChange={(event) => onChange(event.target.value)}
            className={cn(
              "min-h-32 w-full rounded-xl border bg-ink px-4 py-3 text-sm leading-relaxed text-white focus:outline-none",
              error ? "border-alert/70 focus:border-alert" : "border-line-strong focus:border-electric",
            )}
          />
          {error && (
            <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-[#ff7a7a]">
              {error}
            </p>
          )}
          <div id={`${id}-vars`} className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-mist">
            Inserir:
            {info.variables.map((variable) => (
              <button
                key={variable}
                type="button"
                onClick={() => insert(variable)}
                className="rounded-full border border-line-strong px-2.5 py-0.5 font-mono text-fog hover:border-electric hover:text-white"
              >
                {`{${variable}}`}
              </button>
            ))}
          </div>
        </div>
        <div aria-label="Prévia da mensagem" className="rounded-2xl bg-[#0b141a] p-4">
          <p className="text-[0.7rem] font-semibold tracking-wide text-emerald-300/80 uppercase">Prévia</p>
          <p className="mt-2 max-w-[22rem] rounded-xl rounded-tl-sm bg-[#202c33] px-3 py-2 text-sm leading-relaxed whitespace-pre-line text-[#e9edef]">
            {fillTemplate(value, SAMPLE_VALUES) || "…"}
          </p>
        </div>
      </div>
    </section>
  );
}

function TemplatesForm({ initial }: { initial: MessageTemplates }) {
  const toast = useToast();
  const [values, setValues] = useState<MessageTemplates>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useMutation(saveMessageTemplates);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = messageTemplatesSchema.safeParse(values);
    if (!result.success) {
      setErrors(fieldErrorsOf(result.error));
      toast.show("Revise as mensagens marcadas em vermelho.", "error");
      return;
    }
    setErrors({});
    const saved = await save.run(result.data);
    if (!saved) {
      toast.show("Não foi possível salvar as mensagens.", "error");
      return;
    }
    setValues(saved);
    toast.show("Mensagens salvas. Os botões de WhatsApp já usam os textos novos.");
  };

  return (
    <form noValidate onSubmit={onSubmit} aria-busy={save.pending} className="space-y-4">
      {MESSAGE_TEMPLATE_KEYS.map((key) => (
        <TemplateCard
          key={key}
          templateKey={key}
          value={values[key]}
          error={errors[key]}
          onChange={(value) => setValues((current) => ({ ...current, [key]: value }))}
        />
      ))}
      {save.error && <InlineError message={save.error.message} />}
      <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] flex justify-end md:bottom-6">
        <Button type="submit" size="lg" disabled={save.pending} className="max-sm:w-full">
          {save.pending ? "Salvando…" : "Salvar mensagens"}
        </Button>
      </div>
    </form>
  );
}

function AutoSendNotice() {
  return (
    <div className="flex gap-4 rounded-3xl border border-electric/30 bg-electric/[0.06] p-5">
      <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-electric/15 text-electric">
        <Clock aria-hidden className="size-5" />
      </span>
      <div className="text-sm">
        <p className="font-semibold text-white">Envio automático: em breve</p>
        <p className="mt-1 leading-relaxed text-mist">
          Hoje estas mensagens já vêm prontas quando você clica em <MessageCircle aria-hidden className="inline size-3.5" />{" "}
          WhatsApp em Pedidos, Clientes e CRM. O disparo sozinho, a cada mudança de pedido, precisa da API oficial do
          WhatsApp Business (Meta) e de um número só para a loja. Quando ligarmos, os textos daqui continuam valendo.
        </p>
      </div>
    </div>
  );
}

export default function AutomationPage() {
  const templates = useAdminQuery(getMessageTemplates, "message-templates");
  return (
    <div className="space-y-6">
      <PageHeader title="Automação" description="Mensagens do WhatsApp para cada momento da venda." />
      <AutoSendNotice />
      {templates.status === "loading" && <LoadingBlock />}
      {templates.status === "error" && <ErrorState message={templates.error.message} onRetry={templates.reload} />}
      {templates.status === "success" && <TemplatesForm initial={templates.data} />}
    </div>
  );
}
