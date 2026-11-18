import { Plus, Trash2, X } from "lucide-react";
import { useId, type ReactNode } from "react";
import {
  FLOW_CHECK_LABEL,
  FLOW_LIMITS,
  FLOW_NODE_INFO,
  FLOW_TRIGGER_LABEL,
  newOptionId,
  type FlowCheck,
  type FlowNode,
  type FlowTrigger,
} from "@/domain/whatsapp-flow";
import { cn } from "@/ui/lib/cn";
import { compactButton } from "../whatsapp/styles";
import { NODE_LOOK } from "./nodeMeta";

const INPUT =
  "w-full rounded-lg border border-line-strong bg-night px-3 py-2 text-sm text-white placeholder:text-mist/60 transition-colors focus:border-white/30 focus:outline-none";

function Field({ label, hint, count, children }: { label: string; hint?: ReactNode; count?: { value: number; max: number }; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-xs font-medium text-fog">
          {label}
        </label>
        {count && (
          <span className={cn("text-[0.7rem] tabular-nums", count.value > count.max ? "text-[#ff7a7a]" : "text-mist")}>
            {count.value}/{count.max}
          </span>
        )}
      </div>
      {children(id)}
      {hint && <p className="text-[0.7rem] leading-relaxed text-mist">{hint}</p>}
    </div>
  );
}

interface NodeInspectorProps {
  node: FlowNode;
  onChange: (data: FlowNode["data"]) => void;
  onDelete: () => void;
  onClose: () => void;
}

/** Edita o bloco escolhido no quadro. */
export function NodeInspector({ node, onChange, onDelete, onClose }: NodeInspectorProps) {
  const { icon: Icon, tone } = NODE_LOOK[node.type];
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-night ring-1 ring-line-strong">
          <Icon aria-hidden className={cn("size-4", tone)} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-white">{FLOW_NODE_INFO[node.type].label}</h3>
          <p className="text-xs text-mist">{FLOW_NODE_INFO[node.type].hint}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar edição do bloco" className={compactButton.icon}>
          <X aria-hidden className="size-4" />
        </button>
      </div>

      {node.type === "start" && (
        <>
          <Field label="Começa quando">
            {(id) => (
              <select
                id={id}
                value={node.data.trigger}
                onChange={(event) => onChange({ ...node.data, trigger: event.target.value as FlowTrigger })}
                className={cn(INPUT, "[color-scheme:dark]")}
              >
                {(Object.keys(FLOW_TRIGGER_LABEL) as FlowTrigger[]).map((trigger) => (
                  <option key={trigger} value={trigger}>
                    {FLOW_TRIGGER_LABEL[trigger]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          {node.data.trigger === "keyword" && (
            <Field label="Palavras-chave" hint="Separe por vírgula. Vale a palavra inteira, sem diferença de acento ou maiúscula.">
              {(id) => (
                <input
                  id={id}
                  defaultValue={node.data.keywords.join(", ")}
                  onBlur={(event) =>
                    onChange({
                      ...node.data,
                      keywords: event.target.value
                        .split(",")
                        .map((word) => word.trim().slice(0, FLOW_LIMITS.keyword))
                        .filter(Boolean)
                        .slice(0, FLOW_LIMITS.keywords),
                    })
                  }
                  placeholder="afiliado, parceria"
                  className={INPUT}
                />
              )}
            </Field>
          )}
          <p className="text-[0.7rem] leading-relaxed text-mist">
            Se mais de um fluxo servir, vale primeiro o de palavra-chave, depois o de primeira mensagem e por último o de qualquer mensagem.
          </p>
        </>
      )}

      {(node.type === "message" || node.type === "question") && (
        <Field
          label={node.type === "message" ? "Mensagem" : "Pergunta"}
          count={{ value: node.data.text.length, max: FLOW_LIMITS.text }}
          hint="*negrito* e _itálico_ funcionam como no WhatsApp."
        >
          {(id) => (
            <textarea
              id={id}
              rows={5}
              value={node.data.text}
              maxLength={FLOW_LIMITS.text}
              onChange={(event) => onChange({ ...node.data, text: event.target.value })}
              className={cn(INPUT, "resize-y leading-relaxed")}
            />
          )}
        </Field>
      )}

      {node.type === "question" && (
        <fieldset className="space-y-2">
          <legend className="mb-1.5 text-xs font-medium text-fog">Opções</legend>
          {node.data.options.map((option, index) => (
            <div key={option.id} className="flex items-center gap-2">
              <span className="w-4 shrink-0 text-right text-xs text-mist tabular-nums">{index + 1}</span>
              <input
                aria-label={`Opção ${index + 1}`}
                value={option.label}
                maxLength={FLOW_LIMITS.optionLabel}
                onChange={(event) =>
                  onChange({
                    ...node.data,
                    options: node.data.options.map((item) => (item.id === option.id ? { ...item, label: event.target.value } : item)),
                  })
                }
                className={INPUT}
              />
              <button
                type="button"
                aria-label={`Remover opção ${index + 1}`}
                disabled={node.data.options.length <= 1}
                onClick={() => onChange({ ...node.data, options: node.data.options.filter((item) => item.id !== option.id) })}
                className={compactButton.icon}
              >
                <Trash2 aria-hidden className="size-4" />
              </button>
            </div>
          ))}
          {node.data.options.length < FLOW_LIMITS.options && (
            <button
              type="button"
              onClick={() =>
                onChange({ ...node.data, options: [...node.data.options, { id: newOptionId(), label: `Opção ${node.data.options.length + 1}` }] })
              }
              className={cn(compactButton.secondary, "ml-6")}
            >
              <Plus aria-hidden className="size-3.5" /> Adicionar opção
            </button>
          )}
          <p className="text-[0.7rem] leading-relaxed text-mist">
            Até {FLOW_LIMITS.optionLabel} letras cada. Até 3 opções viram botões no WhatsApp; mais que isso, uma lista. O cliente também pode
            responder com o número. "Outra resposta" é o caminho quando ele escreve outra coisa.
          </p>
        </fieldset>
      )}

      {node.type === "condition" && (
        <Field label="Pergunta para decidir o caminho" hint="Cliente e afiliado vêm do tipo do contato na aba WhatsApp. O horário é o da aba IA.">
          {(id) => (
            <select
              id={id}
              value={node.data.check}
              onChange={(event) => onChange({ check: event.target.value as FlowCheck })}
              className={cn(INPUT, "[color-scheme:dark]")}
            >
              {(Object.keys(FLOW_CHECK_LABEL) as FlowCheck[]).map((check) => (
                <option key={check} value={check}>
                  {FLOW_CHECK_LABEL[check]}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}

      {node.type === "ai" && (
        <p className="text-xs leading-relaxed text-mist">
          A IA responde esta mensagem e as próximas, com o que está configurado na aba IA de atendimento. Se a IA estiver desligada, a conversa espera
          você na aba WhatsApp.
        </p>
      )}

      {node.type === "handoff" && (
        <Field
          label="Recado para você"
          count={{ value: node.data.note.length, max: FLOW_LIMITS.note }}
          hint="Aparece no topo da conversa e no aviso do celular."
        >
          {(id) => (
            <textarea
              id={id}
              rows={3}
              value={node.data.note}
              maxLength={FLOW_LIMITS.note}
              onChange={(event) => onChange({ note: event.target.value })}
              placeholder="Ex.: quer ser afiliado"
              className={cn(INPUT, "resize-y")}
            />
          )}
        </Field>
      )}

      {node.type !== "start" && (
        <button type="button" onClick={onDelete} className={cn(compactButton.secondary, "text-[#ff7a7a] hover:border-alert/50 hover:text-[#ff9a9a]")}>
          <Trash2 aria-hidden className="size-3.5" /> Apagar bloco
        </button>
      )}
    </div>
  );
}
