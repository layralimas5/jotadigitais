import { ArrowUp, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CONTACT_KINDS, CONTACT_KIND_LABEL, type WhatsAppContactKind } from "@/domain/whatsapp";
import {
  FLOW_TRIGGER_LABEL,
  answerFlow,
  renderWithOptions,
  startFlow,
  startNodeOf,
  triggerMatches,
  type FlowGraph,
  type FlowStep,
} from "@/domain/whatsapp-flow";
import { cn } from "@/ui/lib/cn";
import { ChatBubble } from "../whatsapp/ChatBubble";
import { compactButton } from "../whatsapp/styles";

type Turn = { id: number; role: "customer" | "store" | "note"; text: string };

interface FlowSimulatorProps {
  graph: FlowGraph;
}

/** Conversa de mentira com o fluxo que está na tela (mesmo sem salvar). Não manda nada a ninguém. */
export function FlowSimulator({ graph }: FlowSimulatorProps) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [waitingAt, setWaitingAt] = useState<string | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [kind, setKind] = useState<WhatsAppContactKind>("lead");
  const [businessHours, setBusinessHours] = useState(true);
  const counter = useRef(0);
  const endRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [turns.length]);

  const reset = () => {
    setTurns([]);
    setWaitingAt(null);
    setOptions([]);
  };

  const apply = (step: FlowStep): Turn[] => {
    const added: Turn[] = [];
    let lastOptions: string[] = [];
    for (const action of step.actions) {
      counter.current += 1;
      if (action.type === "send") {
        added.push({ id: counter.current, role: "store", text: renderWithOptions(action.text, action.options) });
        lastOptions = action.options;
      } else if (action.type === "handoff") {
        added.push({ id: counter.current, role: "note", text: `Passou para você${action.note.trim() ? `: ${action.note.trim()}` : "."}` });
      } else {
        added.push({ id: counter.current, role: "note", text: "A IA assume a conversa daqui." });
      }
    }
    if (step.actions.length === 0) {
      counter.current += 1;
      added.push({ id: counter.current, role: "note", text: "O fluxo acabou sem mandar nada. A mensagem segue para a IA." });
    }
    setWaitingAt(step.waitingAt);
    setOptions(step.waitingAt ? lastOptions : []);
    return added;
  };

  const send = (body: string) => {
    const trimmed = body.trim();
    if (!trimmed) return;
    counter.current += 1;
    const customer: Turn = { id: counter.current, role: "customer", text: trimmed };
    const context = { kind, businessHours };
    let reply: Turn[];
    if (waitingAt) {
      reply = apply(answerFlow(graph, waitingAt, trimmed, context));
    } else {
      const start = startNodeOf(graph);
      const isNew = turns.length === 0;
      if (start && triggerMatches(start, { body: trimmed, isNew })) {
        reply = apply(startFlow(graph, context));
      } else {
        counter.current += 1;
        reply = [
          {
            id: counter.current,
            role: "note",
            text: start
              ? `Este fluxo não começa com essa mensagem (${FLOW_TRIGGER_LABEL[start.data.trigger].toLowerCase()}). Ela seguiria para a IA.`
              : "O fluxo está sem início.",
          },
        ];
      }
    }
    setTurns((current) => [...current, customer, ...reply]);
    setText("");
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    send(text);
  };

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
        <button type="button" onClick={reset} className={cn(compactButton.icon, "ml-auto")} aria-label="Recomeçar o teste" title="Recomeçar">
          <RotateCcw aria-hidden className="size-4" />
        </button>
      </div>

      <div className="min-h-48 flex-1 overflow-y-auto rounded-xl border border-line bg-night p-3">
        {turns.length === 0 ? (
          <p className="py-8 text-center text-xs text-mist">Escreva como se fosse o cliente. A primeira mensagem conta como primeiro contato.</p>
        ) : (
          <ol aria-live="polite">
            {turns.map((turn, index) =>
              turn.role === "note" ? (
                <li key={turn.id} className="my-3 text-center text-[0.7rem] text-mist">
                  {turn.text}
                </li>
              ) : (
                <ChatBubble
                  key={turn.id}
                  author={turn.role === "customer" ? "customer" : "system"}
                  body={turn.text}
                  showAuthor={index === 0 || turns[index - 1]!.role !== turn.role}
                />
              ),
            )}
            <li ref={endRef} aria-hidden />
          </ol>
        )}
      </div>

      {options.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Responder com uma opção">
          {options.map((option) => (
            <button key={option} type="button" onClick={() => send(option)} className={compactButton.secondary}>
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
          disabled={!text.trim()}
          aria-label="Enviar no teste do fluxo"
          className={cn("grid size-8 shrink-0 place-items-center rounded-lg", text.trim() ? "bg-white text-ink hover:bg-fog" : "bg-white/[0.06] text-mist")}
        >
          <ArrowUp aria-hidden className="size-4" />
        </button>
      </form>
    </div>
  );
}
