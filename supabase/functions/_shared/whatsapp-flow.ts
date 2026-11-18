// Fluxos do WhatsApp: o passo a passo que o Jota desenha em WhatsApp > Fluxos. Eles não rodam sozinhos: viram o
// roteiro que a IA segue (flowPlaybook), e a IA continua livre para responder o que estiver fora do roteiro.
// Sem imports: o mesmo código serve a função que responde o cliente e o painel.

export type FlowCheck = "is_customer" | "is_affiliate" | "is_student" | "business_hours";

export interface FlowOption {
  id: string;
  label: string;
}

export interface FlowPosition {
  x: number;
  y: number;
}

interface NodeBase<T extends string, D> {
  id: string;
  type: T;
  position: FlowPosition;
  data: D;
}

export type FlowStartNode = NodeBase<"start", Record<string, never>>;
/** O que o cliente diz naquele ponto ("pergunta o preço"). A IA reconhece pela ideia, não pela frase exata. */
export type FlowCustomerNode = NodeBase<"customer", { text: string }>;
export type FlowMessageNode = NodeBase<"message", { text: string }>;
export type FlowQuestionNode = NodeBase<"question", { text: string; options: FlowOption[] }>;
export type FlowConditionNode = NodeBase<"condition", { check: FlowCheck }>;
export type FlowAiNode = NodeBase<"ai", Record<string, never>>;
export type FlowHandoffNode = NodeBase<"handoff", { note: string }>;
export type FlowEndNode = NodeBase<"end", Record<string, never>>;

export type FlowNode =
  | FlowStartNode
  | FlowCustomerNode
  | FlowMessageNode
  | FlowQuestionNode
  | FlowConditionNode
  | FlowAiNode
  | FlowHandoffNode
  | FlowEndNode;

export type FlowNodeType = FlowNode["type"];

export interface FlowEdge {
  id: string;
  source: string;
  /** Saída usada no bloco de origem: `opt:<id>`, `other`, `yes`, `no`; null na saída comum. */
  sourceHandle: string | null;
  target: string;
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export const OTHER_HANDLE = "other";
export const optionHandle = (optionId: string) => `opt:${optionId}`;

/** Limites da Meta: botões de resposta têm até 20 caracteres; lista vai até 10 itens; corpo interativo até 1024. */
export const FLOW_LIMITS = { text: 1024, customer: 300, optionLabel: 20, options: 10, note: 300, nodes: 80 } as const;

const CHECK_QUESTION: Record<FlowCheck, string> = {
  is_customer: "o contato já é cliente (já comprou)?",
  is_affiliate: "o contato é afiliado?",
  is_student: "o contato é aluno?",
  business_hours: "agora está no horário de atendimento da loja?",
};

/** Texto como fica gravado na conversa (e como sai no modo teste): a pergunta com as opções numeradas. */
export function renderWithOptions(text: string, options: readonly string[]): string {
  if (options.length === 0) return text;
  return `${text}\n\n${options.map((label, index) => `${index + 1}. ${label}`).join("\n")}`;
}

const quote = (text: string) => `"${text.trim().replace(/\s+/g, " ")}"`;

/** Passos numerados a partir do início, na ordem em que aparecem (cada caminho em largura). Blocos soltos ficam de fora. */
function numberSteps(graph: FlowGraph): Map<string, number> {
  const steps = new Map<string, number>();
  const start = graph.nodes.find((node) => node.type === "start");
  if (!start) return steps;
  const queue = [start.id];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (steps.has(id)) continue;
    steps.set(id, steps.size + 1);
    for (const edge of graph.edges) if (edge.source === id && !steps.has(edge.target)) queue.push(edge.target);
  }
  return steps;
}

function describeStep(graph: FlowGraph, node: FlowNode, steps: Map<string, number>): string {
  const next = (handle: string | null) =>
    graph.edges
      .filter((edge) => edge.source === node.id && (edge.sourceHandle ?? null) === handle && steps.has(edge.target))
      .map((edge) => `passo ${steps.get(edge.target)}`);
  const then = (handle: string | null = null) => {
    const targets = next(handle);
    if (targets.length === 0) return "";
    return targets.length === 1 ? ` Depois: ${targets[0]}.` : ` Depois, conforme a conversa: ${targets.join(" ou ")}.`;
  };
  switch (node.type) {
    case "start":
      return `Início do atendimento.${then()}`;
    case "customer":
      return `Quando o cliente disser algo com esta ideia: ${quote(node.data.text)}.${then()}`;
    case "message":
      return `Mande exatamente: ${quote(node.data.text)}.${then()}`;
    case "question": {
      const options = node.data.options
        .map((option) => `${quote(option.label)} → ${next(optionHandle(option.id)).join(" ou ") || "siga a conversa"}`)
        .join("; ");
      const other = next(OTHER_HANDLE);
      return `Pergunte exatamente: ${quote(node.data.text)}, com as opções em botões (ferramenta mostrar_opcoes): ${options}.${
        other.length ? ` Se responder outra coisa: ${other.join(" ou ")}.` : ""
      }`;
    }
    case "condition": {
      const yes = next("yes").join(" ou ") || "siga a conversa";
      const no = next("no").join(" ou ") || "siga a conversa";
      return `Confira: ${CHECK_QUESTION[node.data.check]} Se sim: ${yes}. Se não: ${no}.`;
    }
    case "ai":
      return "Conversa livre: atenda com as regras gerais, as perguntas frequentes e as ferramentas.";
    case "handoff":
      return `Passe para o Jota (passar_para_atendente)${node.data.note.trim() ? `, com o motivo ${quote(node.data.note)}` : ""}.`;
    case "end":
      return "Fim deste caminho: não mande mais nada por causa deste fluxo.";
  }
}

/** Um fluxo como roteiro numerado para a IA. */
export function flowPlaybook(name: string, graph: FlowGraph): string {
  const steps = numberSteps(graph);
  const ordered = graph.nodes.filter((node) => steps.has(node.id)).sort((a, b) => steps.get(a.id)! - steps.get(b.id)!);
  const lines = ordered.map((node) => `${steps.get(node.id)}. ${describeStep(graph, node, steps)}`);
  return `### ${name.trim()}\n${lines.join("\n")}`;
}

/** O que precisa ser arrumado antes de ligar o fluxo. Lista vazia = pode ligar. */
export function flowProblems(graph: FlowGraph): string[] {
  const problems: string[] = [];
  const starts = graph.nodes.filter((node) => node.type === "start");
  if (starts.length !== 1) problems.push("O fluxo precisa de exatamente um bloco de início.");
  const steps = numberSteps(graph);
  if (starts[0] && steps.size <= 1) problems.push("Ligue o início ao primeiro passo.");
  if (graph.nodes.some((node) => !steps.has(node.id))) problems.push("Tem bloco solto: ligue ele ao fluxo ou apague.");
  for (const node of graph.nodes) {
    if ((node.type === "message" || node.type === "question" || node.type === "customer") && !node.data.text.trim()) {
      const label = node.type === "message" ? "mensagem" : node.type === "question" ? "pergunta" : "mensagem do cliente";
      problems.push(`Um bloco de ${label} está sem texto.`);
    }
    if (node.type === "question") {
      if (node.data.options.length === 0) problems.push("Uma pergunta está sem opções.");
      if (node.data.options.some((option) => !option.label.trim())) problems.push("Uma pergunta tem opção sem texto.");
    }
  }
  return [...new Set(problems)];
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string";

/** Lê o grafo vindo do banco sem confiar nele: blocos ou ligações inválidos ficam de fora. */
export function parseFlowGraph(value: unknown): FlowGraph {
  if (!isRecord(value)) return { nodes: [], edges: [] };
  const rawNodes = Array.isArray(value.nodes) ? value.nodes : [];
  const nodes: FlowNode[] = [];
  for (const raw of rawNodes) {
    if (!isRecord(raw) || !isString(raw.id) || !isString(raw.type)) continue;
    const position = isRecord(raw.position) ? { x: Number(raw.position.x) || 0, y: Number(raw.position.y) || 0 } : { x: 0, y: 0 };
    const data = isRecord(raw.data) ? raw.data : {};
    const base = { id: raw.id, position };
    const text = isString(data.text) ? data.text : "";
    switch (raw.type) {
      case "start":
        nodes.push({ ...base, type: "start", data: {} });
        break;
      case "customer":
        nodes.push({ ...base, type: "customer", data: { text } });
        break;
      case "message":
        nodes.push({ ...base, type: "message", data: { text } });
        break;
      case "question": {
        const options = (Array.isArray(data.options) ? data.options : [])
          .filter((option): option is Record<string, unknown> => isRecord(option) && isString(option.id) && isString(option.label))
          .map((option) => ({ id: option.id as string, label: option.label as string }));
        nodes.push({ ...base, type: "question", data: { text, options } });
        break;
      }
      case "condition": {
        const check = (["is_customer", "is_affiliate", "is_student", "business_hours"] as const).find((item) => item === data.check) ?? "is_customer";
        nodes.push({ ...base, type: "condition", data: { check } });
        break;
      }
      case "ai":
        nodes.push({ ...base, type: "ai", data: {} });
        break;
      case "handoff":
        nodes.push({ ...base, type: "handoff", data: { note: isString(data.note) ? data.note : "" } });
        break;
      case "end":
        nodes.push({ ...base, type: "end", data: {} });
        break;
    }
  }
  const ids = new Set(nodes.map((node) => node.id));
  const edges: FlowEdge[] = (Array.isArray(value.edges) ? value.edges : [])
    .filter((raw): raw is Record<string, unknown> => isRecord(raw) && isString(raw.id) && isString(raw.source) && isString(raw.target))
    .filter((raw) => ids.has(raw.source as string) && ids.has(raw.target as string))
    .map((raw) => ({
      id: raw.id as string,
      source: raw.source as string,
      target: raw.target as string,
      sourceHandle: isString(raw.sourceHandle) ? raw.sourceHandle : null,
    }));
  return { nodes, edges };
}
