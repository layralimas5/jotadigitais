import { useEffect, useState } from "react";
import { getWhatsAppAi, getWhatsAppSettings, setWhatsAppAiEnabled } from "@/application/admin-use-cases";
import { WEEKDAYS, aiAnswersAt, type WhatsAppAiSettings, type WhatsAppMode } from "@/domain/whatsapp";
import { cn } from "@/ui/lib/cn";
import { useAdminQuery, useMutation } from "../hooks";
import { useToast } from "../toast";

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
  if (!ai.enabled) return { text: "As mensagens esperam você", active: false };
  const hours = { schedule: ai.schedule, start: ai.businessStart, end: ai.businessEnd, days: ai.businessDays };
  return aiAnswersAt(hours, new Date())
    ? { text: "Respondendo agora", active: true }
    : { text: "Horário comercial: agora é com você", active: false };
}

function ModeLabel({ mode }: { mode: WhatsAppMode }) {
  const live = mode === "live";
  return (
    <span className="inline-flex items-center gap-1.5" title={live ? undefined : "Nada do que acontece aqui chega ao cliente"}>
      <span aria-hidden className={cn("size-1.5 rounded-full", live ? "bg-emerald-400" : "bg-amber-300")} />
      {live ? "WhatsApp oficial conectado" : "Modo teste"}
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
      className="group inline-flex items-center gap-2.5 rounded-md text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-electric disabled:opacity-60"
    >
      <span aria-hidden className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors duration-150", enabled ? "bg-electric" : "bg-line-strong group-hover:bg-[#3a3a50]")}>
        <span className={cn("absolute top-0.5 left-0.5 size-4 rounded-full bg-white transition-transform duration-150 motion-reduce:transition-none", enabled && "translate-x-4")} />
      </span>
      IA {enabled ? "ligada" : "desligada"}
    </button>
  );
}

interface WhatsAppStatusBarProps {
  /** Avisa a tela quando a IA liga ou desliga por aqui (o formulário da IA acompanha). */
  onAiChange?: (ai: WhatsAppAiSettings) => void;
  /** Configuração recém-salva pela aba Automação > IA: a faixa mostra o horário novo sem buscar de novo. */
  saved?: WhatsAppAiSettings | null;
}

/** Linha no topo da aba WhatsApp: liga e desliga a IA, quem responde agora, horário e modo. */
export function WhatsAppStatusBar({ onAiChange, saved }: WhatsAppStatusBarProps) {
  const ai = useAdminQuery(getWhatsAppAi, "whatsapp-ai");
  const settings = useAdminQuery(getWhatsAppSettings, "whatsapp-settings");
  const [local, setLocal] = useState<WhatsAppAiSettings | null>(null);
  const loaded = ai.status === "success" ? ai.data : null;
  useEffect(() => setLocal(loaded), [loaded]);
  useEffect(() => {
    if (saved) setLocal(saved);
  }, [saved]);

  if (!local || settings.status !== "success") {
    return <div aria-hidden className="h-11 animate-pulse border-y border-line motion-reduce:animate-none" />;
  }
  const now = nowLabel(local);

  return (
    <section
      aria-label="Situação do atendimento no WhatsApp"
      className="flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-line py-2.5"
    >
      <AiSwitch
        ai={local}
        onChange={(next) => {
          setLocal(next);
          onAiChange?.(next);
        }}
      />
      <p className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mist">
        <span className={cn(now.active && "text-fog")}>{now.text}</span>
        <span aria-hidden className="text-line-strong">/</span>
        <span>{scheduleLabel(local)}</span>
        <span aria-hidden className="text-line-strong">/</span>
        <ModeLabel mode={settings.data.mode} />
      </p>
    </section>
  );
}
