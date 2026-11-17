import { Bot, FlaskConical, MessagesSquare, Radio, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { getWhatsAppAi, getWhatsAppSettings, setWhatsAppAiEnabled } from "@/application/admin-use-cases";
import { WEEKDAYS, aiAnswersAt, type WhatsAppAiSettings, type WhatsAppMode } from "@/domain/whatsapp";
import { ButtonLink } from "@/ui/components/Button";
import { cn } from "@/ui/lib/cn";
import { useAdminQuery, useMutation } from "../hooks";
import { useToast } from "../toast";
import { WHATSAPP_PATH, aiSettingsLink } from "./links";

/** "Seg a Sáb", "Seg, Qua e Sex". */
export function daysLabel(days: readonly number[]): string {
  const sorted = [...days].sort();
  const names = sorted.map((day) => WEEKDAYS.find((item) => item.value === day)?.short ?? "");
  const consecutive = sorted.length > 2 && sorted.every((day, index) => index === 0 || day === sorted[index - 1]! + 1);
  if (consecutive) return `${names[0]} a ${names[names.length - 1]}`;
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}` : (names[0] ?? "");
}

function scheduleLabel(ai: WhatsAppAiSettings): string {
  const hours = `${daysLabel(ai.businessDays)}, ${ai.businessStart} às ${ai.businessEnd}`;
  return ai.schedule === "always" ? "Responde 24 horas" : `Só fora do horário comercial (${hours})`;
}

function nowLabel(ai: WhatsAppAiSettings): { text: string; active: boolean } {
  if (!ai.enabled) return { text: "IA desligada: as mensagens esperam você", active: false };
  const hours = { schedule: ai.schedule, start: ai.businessStart, end: ai.businessEnd, days: ai.businessDays };
  return aiAnswersAt(hours, new Date())
    ? { text: "IA respondendo agora", active: true }
    : { text: "Horário comercial: agora quem responde é você", active: false };
}

function ModeBadge({ mode }: { mode: WhatsAppMode }) {
  const live = mode === "live";
  const Icon = live ? Radio : FlaskConical;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        live ? "border-emerald-400/40 text-emerald-300" : "border-amber-300/40 text-amber-200",
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {live ? "WhatsApp oficial conectado" : "Modo teste: nada sai para o cliente"}
    </span>
  );
}

function AiSwitch({ ai, onChange }: { ai: WhatsAppAiSettings; onChange: (next: WhatsAppAiSettings) => void }) {
  const toast = useToast();
  const save = useMutation(setWhatsAppAiEnabled);
  const [enabled, setEnabled] = useState(ai.enabled);
  useEffect(() => setEnabled(ai.enabled), [ai.enabled]);

  const toggle = async () => {
    const next = !enabled;
    setEnabled(next);
    const saved = await save.run(next);
    if (!saved) {
      setEnabled(!next);
      toast.show("Não foi possível mudar a IA. Tente de novo.", "error");
      return;
    }
    onChange(saved);
    toast.show(next ? "IA ligada. Ela responde os clientes conforme o horário." : "IA desligada. As mensagens esperam você no WhatsApp.");
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={save.pending}
      onClick={() => void toggle()}
      className="inline-flex items-center gap-2.5 rounded-full border border-line-strong bg-ink py-1.5 pr-3 pl-1.5 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric disabled:opacity-60"
    >
      <span aria-hidden className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", enabled ? "bg-electric" : "bg-line-strong")}>
        <span className={cn("absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform", enabled && "translate-x-5")} />
      </span>
      IA {enabled ? "ligada" : "desligada"}
    </button>
  );
}

interface WhatsAppStatusBarProps {
  /** Em qual aba a faixa está: o atalho leva para a outra. */
  current: "conversations" | "automation";
  /** Avisa a tela quando a IA liga ou desliga por aqui (o formulário da IA acompanha). */
  onAiChange?: (ai: WhatsAppAiSettings) => void;
  /** Configuração recém-salva pela aba Automação > IA: a faixa mostra o horário novo sem buscar de novo. */
  saved?: WhatsAppAiSettings | null;
}

/** Faixa igual no topo das abas WhatsApp e Automação: liga e desliga a IA, modo, horário e o atalho entre as duas. */
export function WhatsAppStatusBar({ current, onAiChange, saved }: WhatsAppStatusBarProps) {
  const ai = useAdminQuery(getWhatsAppAi, "whatsapp-ai");
  const settings = useAdminQuery(getWhatsAppSettings, "whatsapp-settings");
  const [local, setLocal] = useState<WhatsAppAiSettings | null>(null);
  const loaded = ai.status === "success" ? ai.data : null;
  useEffect(() => setLocal(loaded), [loaded]);
  useEffect(() => {
    if (saved) setLocal(saved);
  }, [saved]);

  if (!local || settings.status !== "success") {
    return <div aria-hidden className="h-[4.5rem] animate-pulse rounded-3xl border border-line bg-surface/60 motion-reduce:animate-none" />;
  }
  const now = nowLabel(local);

  return (
    <section aria-label="Situação do atendimento no WhatsApp" className="rounded-3xl border border-line bg-surface/60 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <AiSwitch
          ai={local}
          onChange={(next) => {
            setLocal(next);
            onAiChange?.(next);
          }}
        />
        <ModeBadge mode={settings.data.mode} />
        <div className="ml-auto max-sm:w-full">
          {current === "conversations" ? (
            <ButtonLink to={aiSettingsLink()} variant="secondary" className="max-sm:w-full">
              <SlidersHorizontal aria-hidden className="size-4" /> Configurar IA
            </ButtonLink>
          ) : (
            <ButtonLink to={WHATSAPP_PATH} variant="secondary" className="max-sm:w-full">
              <MessagesSquare aria-hidden className="size-4" /> Ver conversas
            </ButtonLink>
          )}
        </div>
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-mist">
        <Bot aria-hidden className={cn("size-4", now.active ? "text-electric" : "text-mist")} />
        <span className={cn("font-medium", now.active ? "text-white" : "text-fog")}>{now.text}</span>
        <span aria-hidden>·</span>
        <span>{scheduleLabel(local)}</span>
      </p>
    </section>
  );
}
