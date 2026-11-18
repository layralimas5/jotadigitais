import { ArrowUp, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { simulateWhatsAppAi } from "@/application/admin-use-cases";
import { CONTACT_KINDS, CONTACT_KIND_LABEL, type WhatsAppContactKind } from "@/domain/whatsapp";
import { renderWithOptions, type FlowGraph } from "@/domain/whatsapp-flow";
import { cn } from "@/ui/lib/cn";
import { InlineError } from "../components/AdminUi";
import { useMutation } from "../hooks";
import { ChatBubble } from "../whatsapp/ChatBubble";
import { compactButton } from "../whatsapp/styles";

const TOOL_LABEL: Record<string, string> = {
  buscar_contas: "consultou a vitrine",
  situacao_pedido: "consultou o pedido",
  passar_para_atendente: "chamou você",
};

type Turn = { role: "user" | "assistant"; text: string; options?: string[]; note?: string };

interface FlowSimulatorProps {
  flow: { id?: string; name: string; graph: FlowGraph };
}

/** Conversa de teste com a IA seguindo o fluxo da tela (mesmo sem salvar ou desligado). Não manda nada a ninguém. */
export function FlowSimulator({ flow }: FlowSimulatorProps) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [kind, setKind] = useState<WhatsAppContactKind>("lead");
  const [businessHours, setBusinessHours] = useState(true);
  const ask = useMutation(simulateWhatsAppAi);
  const endRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [turns.length, ask.pending]);

  const send = async (body: string) => {
    const trimmed = body.trim();
    if (!trimmed || ask.pending) return;
    const history: Turn[] = [...turns, { role: "user", text: trimmed }];
    setTurns(history);
    setText("");
    const result = await ask.run(
      history.map((turn) => ({ role: turn.role, text: turn.options?.length ? renderWithOptions(turn.text, turn.options) : turn.text })),
      null,
      { flow, contactKind: kind, businessHours },
    );
    if (!result) return;
    const tools = [...new Set(result.toolsUsed)].filter((name) => TOOL_LABEL[name]).map((name) => TOOL_LABEL[name]);
    const note = [tools.length ? `A IA ${tools.join(" e ")}.` : null, result.handoff ? `Passou para você: ${result.handoff.reason}.` : null]
      .filter(Boolean)
      .join(" ");
    setTurns([
      ...history,
      {
        role: "assistant",
        text: result.reply ?? "(A IA não respondeu. No atendimento real, a conversa iria para você.)",
        options: result.options,
        note: note || undefined,
      },
    ]);
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void send(text);
  };

  const last = turns[turns.length - 1];
  const pendingOptions = last?.role === "assistant" ? (last.options ?? []) : [];

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-mist">
        <label className="inline-flex items-center gap-1.5">
          Cliente é
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as WhatsAppContactKind)}
            className="rounded bg-transparent text-fog [color-scheme:dark] focus-visible:outline-2 focus-visible:outline-electric"
          >
            {CONTACT_KINDS.map((value) => (
              <option key={value} value={value}>
                {CONTACT_KIND_LABEL[value].toLowerCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-flex items-center gap-1.5">
          <input type="checkbox" checked={businessHours} onChange={(event) => setBusinessHours(event.target.checked)} className="accent-electric" />
          No horário da loja
        </label>
        <button type="button" onClick={() => setTurns([])} className={cn(compactButton.icon, "ml-auto")} aria-label="Recomeçar o teste" title="Recomeçar">
          <RotateCcw aria-hidden className="size-4" />
        </button>
      </div>

      <div className="min-h-48 flex-1 overflow-y-auto rounded-xl border border-line bg-night p-3">
        {turns.length === 0 ? (
          <p className="py-8 text-center text-xs leading-relaxed text-mist">
            Escreva como se fosse o cliente. A IA segue este fluxo e responde o que estiver fora dele com as regras da aba IA.
          </p>
        ) : (
          <ol aria-live="polite">
            {turns.map((turn, index) => (
              <ChatBubble
                key={index}
                author={turn.role === "user" ? "customer" : "ai"}
                body={turn.options?.length ? renderWithOptions(turn.text, turn.options) : turn.text}
                showAuthor={index === 0 || turns[index - 1]!.role !== turn.role}
                footer={turn.note && <p className="mt-1 max-w-[min(85%,32rem)] px-1 text-right text-[0.7rem] text-amber-200/90">{turn.note}</p>}
              />
            ))}
            {ask.pending && (
              <li className="mt-1 flex justify-end">
                <span className="rounded-2xl rounded-br-md bg-[#0f2236] px-3.5 py-2 text-xs text-mist motion-safe:animate-pulse">Digitando…</span>
              </li>
            )}
            <li ref={endRef} aria-hidden />
          </ol>
        )}
      </div>

      {ask.error && <InlineError message={ask.error.message} />}

      {pendingOptions.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Responder com uma opção">
          {pendingOptions.map((option) => (
            <button key={option} type="button" onClick={() => void send(option)} className={compactButton.secondary}>
              {option}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={onSubmit} className="flex items-center gap-2 rounded-xl border border-line-strong bg-night py-1.5 pr-1.5 pl-3.5 focus-within:border-white/25">
        <label htmlFor="flow-sim-input" className="sr-only">
          Mensagem do cliente para testar o fluxo
        </label>
        <input
          id="flow-sim-input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Mensagem do cliente"
          className="min-w-0 flex-1 bg-transparent py-1 text-sm text-white placeholder:text-mist/70 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!text.trim() || ask.pending}
          aria-label="Enviar no teste do fluxo"
          className={cn("grid size-8 shrink-0 place-items-center rounded-lg", text.trim() ? "bg-white text-ink hover:bg-fog" : "bg-white/[0.06] text-mist")}
        >
          <ArrowUp aria-hidden className="size-4" />
        </button>
      </form>
    </div>
  );
}
