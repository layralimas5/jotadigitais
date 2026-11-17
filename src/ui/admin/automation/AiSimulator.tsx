import { RotateCcw, SendHorizontal, Sparkles } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { simulateWhatsAppAi } from "@/application/admin-use-cases";
import type { AiDraft, SimulatorTurn } from "@/domain/whatsapp";
import { Button } from "@/ui/components/Button";
import { InlineError } from "../components/AdminUi";
import { useMutation } from "../hooks";
import { ChatBubble } from "../whatsapp/ChatBubble";

const TOOL_LABEL: Record<string, string> = {
  buscar_contas: "consultou a vitrine",
  situacao_pedido: "consultou o pedido",
  passar_para_atendente: "chamou você",
};

interface SimulatedTurn extends SimulatorTurn {
  note?: string;
}

const STARTERS = ["Tem conta de TikTok até 400 reais?", "Faz desconto no Pix?", "Como recebo a conta depois de pagar?"];

/** Conversa de teste com a IA usando o que está na tela, mesmo sem salvar. Nada vai para cliente nenhum. */
export function AiSimulator({ draft }: { draft: AiDraft }) {
  const [turns, setTurns] = useState<SimulatedTurn[]>([]);
  const [text, setText] = useState("");
  const ask = useMutation(simulateWhatsAppAi);
  const inputId = useId();
  const endRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [turns.length, ask.pending]);

  const send = async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed || ask.pending) return;
    const history: SimulatedTurn[] = [...turns, { role: "user", text: trimmed }];
    setTurns(history);
    setText("");
    const result = await ask.run(
      history.map(({ role, text: body }) => ({ role, text: body })),
      draft,
    );
    if (!result) return;
    const tools = [...new Set(result.toolsUsed)].map((name) => TOOL_LABEL[name] ?? name);
    const note = [
      tools.length ? `A IA ${tools.join(" e ")}.` : null,
      result.handoff ? `Passou para você: ${result.handoff.reason}. ${result.handoff.summary}` : null,
    ]
      .filter(Boolean)
      .join(" ");
    setTurns([
      ...history,
      { role: "assistant", text: result.reply ?? "(A IA não respondeu. No atendimento real, a conversa iria para você.)", note: note || undefined },
    ]);
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void send(text);
  };

  return (
    <section aria-labelledby="ai-simulator-title" className="flex flex-col rounded-3xl border border-line bg-surface/60 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="ai-simulator-title" className="flex items-center gap-2 font-display text-base font-semibold text-white">
            <Sparkles aria-hidden className="size-4 text-electric" /> Testar a IA
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-mist">
            Escreva como se fosse um cliente. Usa o que está na tela, mesmo sem salvar, e não envia nada.
          </p>
        </div>
        {turns.length > 0 && (
          <Button type="button" variant="ghost" onClick={() => setTurns([])} aria-label="Recomeçar a conversa de teste">
            <RotateCcw aria-hidden className="size-4" />
          </Button>
        )}
      </div>

      <div className="mt-4 min-h-64 flex-1 overflow-y-auto rounded-xl border border-line bg-night p-3 lg:max-h-[28rem]">
        {turns.length === 0 ? (
          <div className="flex h-full min-h-56 flex-col items-center justify-center gap-2 text-center">
            <p className="text-xs text-mist">Comece com uma destas:</p>
            {STARTERS.map((starter) => (
              <button
                key={starter}
                type="button"
                onClick={() => void send(starter)}
                className="rounded-full border border-line-strong px-3 py-1.5 text-xs text-fog hover:border-electric/60 hover:text-white"
              >
                {starter}
              </button>
            ))}
          </div>
        ) : (
          <ol aria-live="polite">
            {turns.map((turn, index) => (
              <ChatBubble
                key={index}
                author={turn.role === "user" ? "customer" : "ai"}
                body={turn.text}
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

      {ask.error && (
        <div className="mt-3">
          <InlineError message={ask.error.message} />
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-3 flex items-end gap-2">
        <label htmlFor={inputId} className="sr-only">
          Mensagem do cliente de teste
        </label>
        <input
          id={inputId}
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={1000}
          placeholder="Mensagem do cliente…"
          className="h-11 min-w-0 flex-1 rounded-full border border-line-strong bg-ink px-4 text-sm text-white placeholder:text-mist/70 focus:border-electric focus:outline-none"
        />
        <Button type="submit" disabled={!text.trim() || ask.pending} aria-label="Enviar mensagem de teste" className="size-11 px-0">
          <SendHorizontal aria-hidden className="size-4" />
        </Button>
      </form>
    </section>
  );
}
