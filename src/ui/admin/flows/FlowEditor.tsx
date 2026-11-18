import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type IsValidConnection,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./flows.css";
import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { deleteWhatsAppFlow, saveWhatsAppFlow } from "@/application/admin-use-cases";
import { whatsAppFlowSchema } from "@/application/schemas";
import {
  ADDABLE_NODE_TYPES,
  FLOW_NAME_MAX,
  FLOW_NODE_INFO,
  createNode,
  flowProblems,
  newEdgeId,
  type FlowNode,
  type FlowNodeType,
  type WhatsAppFlow,
} from "@/domain/whatsapp-flow";
import { cn } from "@/ui/lib/cn";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useMutation } from "../hooks";
import { useToast } from "../toast";
import { compactButton } from "../whatsapp/styles";
import { edgesWithoutRemovedOptions, toCanvasEdges, toCanvasNodes, toGraph } from "./canvas";
import { FlowSimulator } from "./FlowSimulator";
import { NODE_TYPES, type CanvasNode } from "./FlowNodeView";
import { NodeInspector } from "./NodeInspector";
import { DRAG_MIME, NODE_LOOK } from "./nodeMeta";

type AddableType = Exclude<FlowNodeType, "start">;

/** Largura do bloco no quadro (w-60). */
const NODE_WIDTH = 240;

const EDGE_OPTIONS = {
  type: "smoothstep",
  style: { stroke: "#4a4a62", strokeWidth: 1.5 },
  markerEnd: { type: MarkerType.ArrowClosed, color: "#4a4a62", width: 16, height: 16 },
} as const;

/** Mudanças que não alteram o fluxo: escolher um bloco ou o quadro medir o tamanho deles. */
const isCosmetic = (change: NodeChange<CanvasNode> | EdgeChange) => change.type === "select" || change.type === "dimensions";

/** Barra de blocos dentro do quadro, como no Miro: clique para pôr no centro ou arraste até o lugar. */
function Palette({ onAdd }: { onAdd: (type: AddableType) => void }) {
  const onDragStart = (event: DragEvent<HTMLButtonElement>, type: AddableType) => {
    event.dataTransfer.setData(DRAG_MIME, type);
    event.dataTransfer.effectAllowed = "move";
  };
  return (
    <div role="group" aria-label="Adicionar bloco" className="flex flex-col gap-0.5 rounded-xl border border-line-strong bg-surface-2/95 p-1 backdrop-blur">
      {ADDABLE_NODE_TYPES.map((type) => {
        const { icon: Icon, tone } = NODE_LOOK[type];
        return (
          <button
            key={type}
            type="button"
            draggable
            onDragStart={(event) => onDragStart(event, type)}
            onClick={() => onAdd(type)}
            title={`${FLOW_NODE_INFO[type].hint} Clique ou arraste para o quadro.`}
            aria-label={`Adicionar bloco ${FLOW_NODE_INFO[type].label}`}
            className="inline-flex h-9 cursor-grab items-center gap-2.5 rounded-lg px-2.5 text-xs font-medium text-fog transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-2 focus-visible:outline-electric active:cursor-grabbing"
          >
            <Icon aria-hidden className={cn("size-4 shrink-0", tone)} />
            <span className="max-lg:sr-only">{FLOW_NODE_INFO[type].label}</span>
          </button>
        );
      })}
    </div>
  );
}

function EnabledSwitch({ enabled, onChange }: { enabled: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className="group inline-flex shrink-0 items-center gap-2 rounded-md text-xs font-medium text-fog focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-electric"
    >
      <span aria-hidden className={cn("relative h-5 w-9 rounded-full transition-colors duration-150", enabled ? "bg-emerald-500" : "bg-line-strong")}>
        <span className={cn("absolute top-0.5 left-0.5 size-4 rounded-full bg-white transition-transform duration-150 motion-reduce:transition-none", enabled && "translate-x-4")} />
      </span>
      {enabled ? "Ligado" : "Desligado"}
    </button>
  );
}

interface FlowEditorProps {
  /** Troca entre fluxos, na mesma linha do nome para o quadro ganhar altura. */
  switcher?: ReactNode;
  flow: WhatsAppFlow | null;
  /** Fluxo novo ainda não salvo: o grafo inicial vem daqui. */
  draft?: Pick<WhatsAppFlow, "name" | "graph">;
  onSaved: (flow: WhatsAppFlow) => void;
  onDeleted: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

function Editor({ switcher, flow, draft, onSaved, onDeleted, onDirtyChange }: FlowEditorProps) {
  const toast = useToast();
  const initial = flow ?? { name: draft?.name ?? "Novo fluxo", enabled: false, graph: draft?.graph ?? { nodes: [], edges: [] } };
  const [name, setName] = useState(initial.name);
  const [enabled, setEnabled] = useState(flow?.enabled ?? false);
  const [nodes, setNodes] = useState<CanvasNode[]>(() => toCanvasNodes(initial.graph));
  const [edges, setEdges] = useState<Edge[]>(() => toCanvasEdges(initial.graph));
  const [dirty, setDirtyState] = useState(flow === null);
  const [panel, setPanel] = useState<"test" | "edit">("test");
  const [errors, setErrors] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, setViewport } = useReactFlow();
  const save = useMutation(saveWhatsAppFlow);
  const remove = useMutation(async (deps, id: string) => {
    await deleteWhatsAppFlow(deps, id);
    return true;
  });

  const setDirty = useCallback(
    (next: boolean) => {
      setDirtyState(next);
      onDirtyChange(next);
    },
    [onDirtyChange],
  );
  useEffect(() => onDirtyChange(flow === null), [flow, onDirtyChange]);

  // Fechar a aba com mudanças sem salvar pede confirmação do navegador.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const graph = useMemo(() => toGraph(nodes, edges), [nodes, edges]);

  // Abre num zoom de leitura, com o início no alto e centralizado; o resto aparece rolando, como num quadro grande.
  const showStart = useCallback(() => {
    const box = canvasRef.current?.getBoundingClientRect();
    const start = nodes.find((node) => node.type === "start");
    if (!box || !start) return;
    const zoom = box.width < 640 ? 0.7 : 0.9;
    void setViewport({ x: box.width / 2 - (start.position.x + NODE_WIDTH / 2) * zoom, y: 32 - start.position.y * zoom, zoom });
    // Só na abertura (sem dependências de propósito): depois o Jota move o quadro como quiser.
  }, []);
  const selected = nodes.filter((node) => node.selected);
  const editing = selected.length === 1 ? (graph.nodes.find((node) => node.id === selected[0]!.id) ?? null) : null;

  const onNodesChange = useCallback(
    (changes: NodeChange<CanvasNode>[]) => {
      setNodes((current) => applyNodeChanges(changes, current));
      if (changes.some((change) => !isCosmetic(change))) setDirty(true);
      if (changes.some((change) => change.type === "select" && change.selected)) setPanel("edit");
    },
    [setDirty],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((current) => applyEdgeChanges(changes, current));
      if (changes.some((change) => !isCosmetic(change))) setDirty(true);
    },
    [setDirty],
  );

  // Cada saída leva a um lugar só: ligar de novo troca o destino.
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((current) =>
        addEdge(
          { ...connection, id: newEdgeId() },
          current.filter((edge) => !(edge.source === connection.source && (edge.sourceHandle ?? null) === (connection.sourceHandle ?? null))),
        ),
      );
      setDirty(true);
    },
    [setDirty],
  );

  const isValidConnection: IsValidConnection = useCallback(
    (connection) => connection.source !== connection.target && nodes.find((node) => node.id === connection.target)?.type !== "start",
    [nodes],
  );

  const addNode = (type: AddableType, at?: { x: number; y: number }) => {
    let position = at;
    if (!position) {
      const box = canvasRef.current?.getBoundingClientRect();
      const center = box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : { x: 0, y: 0 };
      // Blocos adicionados em seguida não ficam um em cima do outro.
      const offset = (nodes.length % 5) * 24;
      position = screenToFlowPosition({ x: center.x - 120 + offset, y: center.y - 60 + offset });
    }
    const node = createNode(type, position);
    setNodes((current) => [...current.map((item) => ({ ...item, selected: false })), { ...toCanvasNodes({ nodes: [node], edges: [] })[0]!, selected: true }]);
    setPanel("edit");
    setDirty(true);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    const type = event.dataTransfer.getData(DRAG_MIME) as AddableType;
    if (!ADDABLE_NODE_TYPES.includes(type)) return;
    event.preventDefault();
    addNode(type, screenToFlowPosition({ x: event.clientX - 120, y: event.clientY - 30 }));
  };

  const updateNode = (id: string, data: FlowNode["data"]) => {
    setNodes((current) => current.map((node) => (node.id === id ? { ...node, data } : node)));
    const changed = graph.nodes.find((node) => node.id === id);
    if (changed) setEdges((current) => edgesWithoutRemovedOptions(current, { ...changed, data } as FlowNode));
    setDirty(true);
  };

  const deleteNode = (id: string) => {
    setNodes((current) => current.filter((node) => node.id !== id));
    setEdges((current) => current.filter((edge) => edge.source !== id && edge.target !== id));
    setPanel("test");
    setDirty(true);
  };

  const toggleEnabled = (next: boolean) => {
    if (next) {
      const problems = flowProblems(graph);
      if (problems.length > 0) {
        setErrors(problems);
        return;
      }
    }
    setErrors([]);
    setEnabled(next);
    setDirty(true);
  };

  const submit = async () => {
    const parsed = whatsAppFlowSchema.safeParse({ name, enabled, graph });
    if (!parsed.success) {
      setErrors([...new Set(parsed.error.issues.map((issue) => issue.message))]);
      return;
    }
    setErrors([]);
    const saved = await save.run({ id: flow?.id, name: parsed.data.name, enabled, graph });
    if (!saved) {
      toast.show("Não foi possível salvar o fluxo. Tente de novo.", "error");
      return;
    }
    setDirty(false);
    toast.show(saved.enabled ? "Fluxo salvo e ligado." : "Fluxo salvo. Ele só roda no WhatsApp quando estiver ligado.");
    onSaved(saved);
  };

  const confirmRemove = async () => {
    if (!flow) {
      setConfirmDelete(false);
      onDeleted();
      return;
    }
    const done = await remove.run(flow.id);
    setConfirmDelete(false);
    if (!done) {
      toast.show("Não foi possível apagar o fluxo.", "error");
      return;
    }
    toast.show("Fluxo apagado.");
    onDeleted();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        {switcher}
        <span aria-hidden className="hidden h-5 w-px bg-line-strong lg:block" />
        <label className="sr-only" htmlFor="flow-name">
          Nome do fluxo
        </label>
        <input
          id="flow-name"
          value={name}
          maxLength={FLOW_NAME_MAX}
          onChange={(event) => {
            setName(event.target.value);
            setDirty(true);
          }}
          className="min-w-0 flex-1 basis-40 rounded-md bg-transparent px-1 py-1 text-sm font-semibold text-white hover:bg-white/[0.03] focus:bg-white/[0.04] focus:outline-none"
        />
        <EnabledSwitch enabled={enabled} onChange={toggleEnabled} />
        <span className={cn("text-xs", dirty ? "text-amber-200" : "text-mist")} aria-live="polite">
          {dirty ? "Não salvo" : "Salvo"}
        </span>
        <button type="button" onClick={() => setConfirmDelete(true)} aria-label="Apagar fluxo" title="Apagar fluxo" className={compactButton.icon}>
          <Trash2 aria-hidden className="size-4" />
        </button>
        <button type="button" onClick={() => void submit()} disabled={save.pending || !dirty} className={compactButton.primary}>
          {save.pending ? "Salvando…" : "Salvar fluxo"}
        </button>
      </div>

      {errors.length > 0 && (
        <ul role="alert" className="space-y-1 border-l-2 border-alert/70 pl-3 text-xs text-[#ff9a9a]">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div
          ref={canvasRef}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          }}
          onDrop={onDrop}
          className="jota-flow h-[65dvh] min-h-[28rem] overflow-hidden rounded-xl border border-line bg-night lg:h-[calc(100dvh-23rem)] lg:min-h-[30rem]"
        >
          <ReactFlow<CanvasNode, Edge>
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            onPaneClick={() => setPanel("test")}
            defaultEdgeOptions={EDGE_OPTIONS}
            deleteKeyCode={["Backspace", "Delete"]}
            colorMode="dark"
            onInit={showStart}
            minZoom={0.25}
            maxZoom={1.5}
          >
            <Panel position="top-left">
              <Palette onAdd={(type) => addNode(type)} />
            </Panel>
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#26263a" />
            <Controls showInteractive={false} position="bottom-left" />
          </ReactFlow>
        </div>

        <aside aria-label="Painel do fluxo" className="flex min-h-[24rem] flex-col rounded-xl border border-line bg-surface/40 lg:h-[calc(100dvh-23rem)] lg:min-h-[30rem]">
          <div role="tablist" aria-label="Painel" className="flex gap-4 border-b border-line px-4 pt-2">
            {(
              [
                ["test", "Testar"],
                ["edit", "Bloco"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={panel === value}
                onClick={() => setPanel(value)}
                className={cn(
                  "-mb-px border-b-2 pt-1 pb-2.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-electric",
                  panel === value ? "border-white font-medium text-white" : "border-transparent text-mist hover:text-fog",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto p-4">
            {panel === "test" && <FlowSimulator graph={graph} />}
            {panel === "edit" &&
              (editing ? (
                <NodeInspector
                  key={editing.id}
                  node={editing}
                  onChange={(data) => updateNode(editing.id, data)}
                  onDelete={() => deleteNode(editing.id)}
                  onClose={() => {
                    setNodes((current) => current.map((node) => ({ ...node, selected: false })));
                    setPanel("test");
                  }}
                />
              ) : (
                <p className="py-8 text-center text-xs leading-relaxed text-mist">
                  Clique num bloco do quadro para editar.
                  <br />
                  Para ligar dois blocos, arraste da bolinha de saída até o próximo.
                </p>
              ))}
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Apagar este fluxo?"
        description="As conversas que estavam no meio dele seguem para a IA. Não dá para desfazer."
        confirmLabel="Apagar fluxo"
        pending={remove.pending}
        onConfirm={() => void confirmRemove()}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  );
}

/** Quadro de um fluxo: arrastar blocos, ligar com setas, editar ao lado e testar na hora. */
export function FlowEditor(props: FlowEditorProps) {
  return (
    <ReactFlowProvider>
      <Editor {...props} />
    </ReactFlowProvider>
  );
}
