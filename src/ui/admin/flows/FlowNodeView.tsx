import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Plus, Trash2, X } from "lucide-react";
import { memo, useLayoutEffect, useRef, type ReactNode, type TextareaHTMLAttributes } from "react";
import {
  FLOW_CHECK_LABEL,
  FLOW_LIMITS,
  FLOW_NODE_INFO,
  OTHER_HANDLE,
  newOptionId,
  optionHandle,
  type FlowCheck,
  type FlowNode,
  type FlowNodeType,
} from "@/domain/whatsapp-flow";
import { cn } from "@/ui/lib/cn";
import { useFlowEdit } from "./flowEditContext";
import { NODE_LOOK } from "./nodeMeta";

export type CanvasNode = Node<FlowNode["data"], FlowNodeType>;

/** Tipo e dados casados por bloco, para o TypeScript saber que "pergunta" tem opções. */
type NodeContent = FlowNode extends infer N ? (N extends FlowNode ? Pick<N, "type" | "data"> : never) : never;

const HANDLE = "!size-2.5 !rounded-full !border-2 !border-surface-2 !bg-mist hover:!bg-white";

// "nodrag" e "nowheel": dentro dos campos, arrastar seleciona texto e a rodinha rola o texto, não o quadro.
const FIELD =
  "nodrag nowheel w-full rounded-md bg-transparent px-1.5 py-1 text-xs leading-relaxed text-fog placeholder:text-mist/60 transition-colors hover:bg-white/[0.03] focus:bg-night focus:text-white focus:outline-none focus:ring-1 focus:ring-white/20";

const SELECT =
  "nodrag w-full cursor-pointer rounded-md bg-transparent px-1 py-1 text-xs text-fog [color-scheme:dark] hover:bg-white/[0.03] focus:outline-none focus:ring-1 focus:ring-white/20";

/** Campo de texto que cresce com o conteúdo, para o bloco mostrar a mensagem inteira. */
function GrowingText({ value, className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const field = ref.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight}px`;
  }, [value]);
  return <textarea ref={ref} rows={1} value={value} {...props} className={cn(FIELD, "resize-none overflow-hidden", className)} />;
}

function OutputRow({ handle, children }: { handle: string; children: ReactNode }) {
  return (
    <li className="group/row relative flex items-center gap-1 rounded-md bg-night py-0.5 pr-1 pl-0.5">
      {children}
      <Handle type="source" position={Position.Right} id={handle} className={cn(HANDLE, "!-right-3")} />
    </li>
  );
}

/** Um bloco no quadro, editável ali mesmo: clicar no texto e escrever. */
function FlowNodeViewBase({ id, type, data, selected }: NodeProps<CanvasNode>) {
  const { updateNode, deleteNode } = useFlowEdit();
  const node = { type, data } as NodeContent;
  const { icon: Icon, tone } = NODE_LOOK[type];
  const singleOutput = node.type === "start" || node.type === "message" || node.type === "customer";
  const label = FLOW_NODE_INFO[type].label;

  return (
    <div
      className={cn(
        "w-64 rounded-xl border bg-surface-2 p-2.5 shadow-[0_1px_2px_rgb(0_0_0/0.4),0_8px_24px_-12px_rgb(0_0_0/0.6)] transition-colors",
        selected ? "border-electric" : "border-line-strong hover:border-[#3a3a50]",
      )}
    >
      {node.type !== "start" && <Handle type="target" position={Position.Top} className={HANDLE} />}
      <div className="mb-1.5 flex h-6 items-center gap-1.5 px-1 text-[0.68rem] font-medium tracking-wide text-mist uppercase" title={FLOW_NODE_INFO[type].hint}>
        <Icon aria-hidden className={cn("size-3.5", tone)} />
        {label}
        {node.type !== "start" && (
          <button
            type="button"
            onClick={() => deleteNode(id)}
            aria-label={`Apagar bloco ${label}`}
            title="Apagar bloco"
            className={cn(
              "nodrag ml-auto grid size-6 place-items-center rounded-md text-mist transition hover:bg-white/[0.06] hover:text-[#ff7a7a] focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-electric",
              selected ? "opacity-100" : "opacity-0",
            )}
          >
            <Trash2 aria-hidden className="size-3.5" />
          </button>
        )}
      </div>

      {node.type === "start" && <p className="px-1.5 text-xs text-fog">Começo do atendimento</p>}

      {node.type === "customer" && (
        <GrowingText
          aria-label="O que o cliente diz"
          value={node.data.text}
          maxLength={FLOW_LIMITS.customer}
          onChange={(event) => updateNode(id, { text: event.target.value })}
          placeholder="O que o cliente diz. Ex.: pergunta o preço"
          className="italic"
        />
      )}

      {(node.type === "message" || node.type === "question") && (
        <GrowingText
          aria-label={node.type === "message" ? "Texto da mensagem" : "Texto da pergunta"}
          value={node.data.text}
          maxLength={FLOW_LIMITS.text}
          onChange={(event) => updateNode(id, { ...node.data, text: event.target.value })}
          placeholder={node.type === "message" ? "Escreva a mensagem" : "Escreva a pergunta"}
        />
      )}

      {node.type === "question" && (
        <ul className="mt-1.5 space-y-1">
          {node.data.options.map((option, index) => (
            <OutputRow key={option.id} handle={optionHandle(option.id)}>
              <span className="w-4 shrink-0 text-center text-[0.65rem] text-mist tabular-nums">{index + 1}</span>
              <input
                aria-label={`Opção ${index + 1}`}
                value={option.label}
                maxLength={FLOW_LIMITS.optionLabel}
                placeholder="Texto do botão"
                onChange={(event) =>
                  updateNode(id, {
                    ...node.data,
                    options: node.data.options.map((item) => (item.id === option.id ? { ...item, label: event.target.value } : item)),
                  })
                }
                className={cn(FIELD, "py-0.5")}
              />
              {node.data.options.length > 1 && (
                <button
                  type="button"
                  aria-label={`Remover opção ${index + 1}`}
                  onClick={() => updateNode(id, { ...node.data, options: node.data.options.filter((item) => item.id !== option.id) })}
                  className="nodrag grid size-5 shrink-0 place-items-center rounded text-mist opacity-0 transition group-hover/row:opacity-100 hover:text-white focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-electric"
                >
                  <X aria-hidden className="size-3" />
                </button>
              )}
            </OutputRow>
          ))}
          <OutputRow handle={OTHER_HANDLE}>
            <span className="px-1.5 py-1 text-xs text-mist" title="Caminho quando o cliente escreve outra coisa">
              Outra resposta
            </span>
          </OutputRow>
          {node.data.options.length < FLOW_LIMITS.options && (
            <li>
              <button
                type="button"
                onClick={() => updateNode(id, { ...node.data, options: [...node.data.options, { id: newOptionId(), label: "" }] })}
                aria-label="Adicionar opção"
                className="nodrag inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[0.7rem] text-mist transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-electric"
              >
                <Plus aria-hidden className="size-3" /> Opção
              </button>
            </li>
          )}
        </ul>
      )}

      {node.type === "condition" && (
        <>
          <select
            aria-label="Condição"
            value={node.data.check}
            onChange={(event) => updateNode(id, { check: event.target.value as FlowCheck })}
            className={SELECT}
          >
            {(Object.keys(FLOW_CHECK_LABEL) as FlowCheck[]).map((check) => (
              <option key={check} value={check}>
                {FLOW_CHECK_LABEL[check]}
              </option>
            ))}
          </select>
          <ul className="mt-1.5 space-y-1">
            <OutputRow handle="yes">
              <span className="px-1.5 py-1 text-xs text-fog">Sim</span>
            </OutputRow>
            <OutputRow handle="no">
              <span className="px-1.5 py-1 text-xs text-fog">Não</span>
            </OutputRow>
          </ul>
        </>
      )}
      {node.type === "ai" && <p className="px-1.5 text-xs text-mist">A IA conversa livre daqui em diante, com as regras e as perguntas frequentes da aba IA.</p>}
      {node.type === "handoff" && (
        <GrowingText
          aria-label="Recado para o Jota"
          value={node.data.note}
          maxLength={FLOW_LIMITS.note}
          onChange={(event) => updateNode(id, { note: event.target.value })}
          placeholder="Recado para você (opcional)"
        />
      )}
      {node.type === "end" && <p className="px-1.5 text-xs text-mist">Este caminho acaba aqui.</p>}

      {singleOutput && <Handle type="source" position={Position.Bottom} className={HANDLE} />}
    </div>
  );
}

export const FlowNodeView = memo(FlowNodeViewBase);

export const NODE_TYPES = {
  start: FlowNodeView,
  customer: FlowNodeView,
  message: FlowNodeView,
  question: FlowNodeView,
  condition: FlowNodeView,
  ai: FlowNodeView,
  handoff: FlowNodeView,
  end: FlowNodeView,
};
