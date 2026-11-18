import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { memo } from "react";
import {
  FLOW_CHECK_LABEL,
  FLOW_NODE_INFO,
  FLOW_TRIGGER_LABEL,
  OTHER_HANDLE,
  optionHandle,
  type FlowNode,
  type FlowNodeType,
} from "@/domain/whatsapp-flow";
import { cn } from "@/ui/lib/cn";
import { NODE_LOOK } from "./nodeMeta";

export type CanvasNode = Node<FlowNode["data"], FlowNodeType>;

/** Tipo e dados casados por bloco, para o TypeScript saber que "pergunta" tem opções. */
type NodeContent = FlowNode extends infer N ? (N extends FlowNode ? Pick<N, "type" | "data"> : never) : never;

const HANDLE = "!size-2.5 !rounded-full !border-2 !border-surface-2 !bg-mist hover:!bg-white";

function OutputRow({ label, handle, muted }: { label: string; handle: string; muted?: boolean }) {
  return (
    <li className="relative flex items-center justify-between gap-2 rounded-md bg-night px-2.5 py-1.5 text-xs">
      <span className={cn("truncate", muted ? "text-mist" : "text-fog")}>{label}</span>
      <Handle type="source" position={Position.Right} id={handle} className={cn(HANDLE, "!-right-3")} />
    </li>
  );
}

function Preview({ text, empty }: { text: string; empty: string }) {
  return <p className={cn("line-clamp-3 text-xs leading-relaxed whitespace-pre-line", text.trim() ? "text-fog" : "text-mist italic")}>{text.trim() || empty}</p>;
}

/** Um bloco no quadro. A forma de cada saída segue o tipo: uma só, uma por opção ou Sim e Não. */
function FlowNodeViewBase({ type, data, selected }: NodeProps<CanvasNode>) {
  const node = { type, data } as NodeContent;
  const { icon: Icon, tone } = NODE_LOOK[type];
  const singleOutput = node.type === "start" || node.type === "message";

  return (
    <div
      className={cn(
        "w-60 rounded-xl border bg-surface-2 p-3 shadow-[0_1px_2px_rgb(0_0_0/0.4),0_8px_24px_-12px_rgb(0_0_0/0.6)] transition-colors",
        selected ? "border-electric" : "border-line-strong hover:border-[#3a3a50]",
      )}
    >
      {node.type !== "start" && <Handle type="target" position={Position.Top} className={HANDLE} />}
      <p className="mb-2 flex items-center gap-1.5 text-[0.7rem] font-medium tracking-wide text-mist uppercase">
        <Icon aria-hidden className={cn("size-3.5", tone)} />
        {FLOW_NODE_INFO[type].label}
      </p>

      {node.type === "start" && (
        <p className="text-xs text-fog">
          {FLOW_TRIGGER_LABEL[node.data.trigger]}
          {node.data.trigger === "keyword" && node.data.keywords.length > 0 && (
            <span className="mt-1 block truncate text-mist">{node.data.keywords.join(", ")}</span>
          )}
        </p>
      )}
      {node.type === "message" && <Preview text={node.data.text} empty="Escreva a mensagem" />}
      {node.type === "question" && (
        <>
          <Preview text={node.data.text} empty="Escreva a pergunta" />
          <ul className="mt-2 space-y-1">
            {node.data.options.map((option) => (
              <OutputRow key={option.id} label={option.label || "Opção sem texto"} handle={optionHandle(option.id)} muted={!option.label} />
            ))}
            <OutputRow label="Outra resposta" handle={OTHER_HANDLE} muted />
          </ul>
        </>
      )}
      {node.type === "condition" && (
        <>
          <p className="text-xs text-fog">{FLOW_CHECK_LABEL[node.data.check]}</p>
          <ul className="mt-2 space-y-1">
            <OutputRow label="Sim" handle="yes" />
            <OutputRow label="Não" handle="no" />
          </ul>
        </>
      )}
      {node.type === "ai" && <p className="text-xs text-mist">A IA conversa a partir daqui.</p>}
      {node.type === "handoff" && <Preview text={node.data.note} empty="Passa a conversa para você" />}
      {node.type === "end" && <p className="text-xs text-mist">Não manda mais nada.</p>}

      {singleOutput && <Handle type="source" position={Position.Bottom} className={HANDLE} />}
    </div>
  );
}

export const FlowNodeView = memo(FlowNodeViewBase);

export const NODE_TYPES = {
  start: FlowNodeView,
  message: FlowNodeView,
  question: FlowNodeView,
  condition: FlowNodeView,
  ai: FlowNodeView,
  handoff: FlowNodeView,
  end: FlowNodeView,
};
