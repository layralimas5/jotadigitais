// Motor dos fluxos do WhatsApp (o "mapa" que o Jota monta em Automação > Fluxos). Sem imports: o mesmo código roda
// na função que recebe as mensagens e no simulador do painel, então o teste mostra exatamente o que o cliente veria.

export type FlowTrigger = "first_contact" | "keyword" | "any_message";
export type FlowCheck = "is_customer" | "is_affiliate" | "is_student" | "business_hours";
export type FlowContactKind = "lead" | "customer" | "affiliate" | "student";

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

export type FlowStartNode = NodeBase<"start", { trigger: FlowTrigger; keywords: string[] }>;
export type FlowMessageNode = NodeBase<"message", { text: string }>;
export type FlowQuestionNode = NodeBase<"question", { text: string; options: FlowOption[] }>;
export type FlowConditionNode = NodeBase<"condition", { check: FlowCheck }>;
export type FlowAiNode = NodeBase<"ai", Record<string, never>>;
export type FlowHandoffNode = NodeBase<"handoff", { note: string }>;
export type FlowEndNode = NodeBase<"end", Record<string, never>>;

export type FlowNode =
  | FlowStartNode
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
  /** Saída usada no bloco de origem: `opt:<id>`, `other`, `yes`, `no`; null na saída única. */
  sourceHandle: string | null;
  target: string;
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export type FlowAction =
  | { type: "send"; text: string; options: string[] }
  | { type: "handoff"; note: string }
  | { type: "ai" };

export interface FlowContext {
  kind: FlowContactKind;
  businessHours: boolean;
}

export interface FlowStep {
  actions: FlowAction[];
  /** Bloco de pergunta esperando a resposta do cliente; null quando o fluxo terminou ou passou a conversa. */
  waitingAt: string | null;
}

export const OTHER_HANDLE = "other";
export const optionHandle = (optionId: string) => `opt:${optionId}`;
export const RETRY_TEXT = "Não entendi. Escolha uma das opções:";

/** Limites da Meta: botões de resposta têm até 20 caracteres; lista vai até 10 itens; corpo interativo até 1024. */
export const FLOW_LIMITS = { text: 1024, optionLabel: 20, options: 10, keywords: 20, keyword: 40, note: 300, nodes: 80 } as const;

const MAX_STEPS = 30;

export const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Texto como fica gravado na conversa (e como sai no modo teste): a pergunta com as opções numeradas. */
export function renderWithOptions(text: string, options: readonly string[]): string {
  if (options.length === 0) return text;
  return `${text}\n\n${options.map((label, index) => `${index + 1}. ${label}`).join("\n")}`;
}

export function startNodeOf(graph: FlowGraph): FlowStartNode | null {
  return (graph.nodes.find((node) => node.type === "start") as FlowStartNode | undefined) ?? null;
}

export function triggerMatches(start: FlowStartNode, message: { body: string; isNew: boolean }): boolean {
  const { trigger, keywords } = start.data;
  if (trigger === "any_message") return true;
  if (trigger === "first_contact") return message.isNew;
  const body = ` ${normalize(message.body)} `;
  return keywords.some((keyword) => {
    const word = normalize(keyword);
    return word.length > 0 && body.includes(` ${word} `);
  });
}

const TRIGGER_PRIORITY: Record<FlowTrigger, number> = { keyword: 0, first_contact: 1, any_message: 2 };

/** Qual fluxo começa com esta mensagem: palavra-chave vence primeiro contato, que vence "qualquer mensagem". */
export function pickFlow<T extends { graph: FlowGraph }>(flows: readonly T[], message: { body: string; isNew: boolean }): T | null {
  const candidates = flows
    .map((flow) => ({ flow, start: startNodeOf(flow.graph) }))
    .filter((item): item is { flow: T; start: FlowStartNode } => item.start !== null && triggerMatches(item.start, message));
  candidates.sort((a, b) => TRIGGER_PRIORITY[a.start.data.trigger] - TRIGGER_PRIORITY[b.start.data.trigger]);
  return candidates[0]?.flow ?? null;
}

function nextNode(graph: FlowGraph, from: string, handle: string | null): FlowNode | null {
  const edge = graph.edges.find((item) => item.source === from && (item.sourceHandle ?? null) === handle);
  return edge ? (graph.nodes.find((node) => node.id === edge.target) ?? null) : null;
}

function checkPasses(check: FlowCheck, context: FlowContext): boolean {
  switch (check) {
    case "is_customer":
      return context.kind === "customer";
    case "is_affiliate":
      return context.kind === "affiliate";
    case "is_student":
      return context.kind === "student";
    case "business_hours":
      return context.businessHours;
  }
}

/** Anda pelos blocos a partir de `node` até precisar de resposta, passar a conversa ou acabar. */
function walk(graph: FlowGraph, node: FlowNode | null, context: FlowContext): FlowStep {
  const actions: FlowAction[] = [];
  let current = node;
  // Um laço desenhado por engano (A -> B -> A) não pode prender a função.
  for (let steps = 0; current && steps < MAX_STEPS; steps += 1) {
    switch (current.type) {
      case "start":
        current = nextNode(graph, current.id, null);
        break;
      case "message":
        if (current.data.text.trim()) actions.push({ type: "send", text: current.data.text, options: [] });
        current = nextNode(graph, current.id, null);
        break;
      case "question":
        actions.push({ type: "send", text: current.data.text, options: current.data.options.map((option) => option.label) });
        return { actions, waitingAt: current.id };
      case "condition":
        current = nextNode(graph, current.id, checkPasses(current.data.check, context) ? "yes" : "no");
        break;
      case "ai":
        actions.push({ type: "ai" });
        return { actions, waitingAt: null };
      case "handoff":
        actions.push({ type: "handoff", note: current.data.note });
        return { actions, waitingAt: null };
      case "end":
        return { actions, waitingAt: null };
    }
  }
  return { actions, waitingAt: null };
}

export function startFlow(graph: FlowGraph, context: FlowContext): FlowStep {
  return walk(graph, startNodeOf(graph), context);
}

/** Qual opção o cliente escolheu: pelo número ("2"), pelo texto do botão ou por uma resposta que contém o texto. */
export function matchOption(options: readonly FlowOption[], input: string): FlowOption | null {
  const answer = normalize(input);
  if (!answer) return null;
  const number = Number.parseInt(answer, 10);
  if (String(number) === answer && number >= 1 && number <= options.length) return options[number - 1]!;
  const exact = options.find((option) => normalize(option.label) === answer);
  if (exact) return exact;
  const contained = options.filter((option) => {
    const label = normalize(option.label);
    return label.length > 0 && ` ${answer} `.includes(` ${label} `);
  });
  return contained.length === 1 ? contained[0]! : null;
}

/** O cliente respondeu a pergunta em que o fluxo parou. Sem opção reconhecida, segue por "Outra resposta" ou repete. */
export function answerFlow(graph: FlowGraph, waitingAt: string, input: string, context: FlowContext): FlowStep {
  const question = graph.nodes.find((node) => node.id === waitingAt);
  if (!question || question.type !== "question") return { actions: [], waitingAt: null };
  const chosen = matchOption(question.data.options, input);
  if (chosen) return walk(graph, nextNode(graph, question.id, optionHandle(chosen.id)), context);
  const fallback = nextNode(graph, question.id, OTHER_HANDLE);
  if (fallback) return walk(graph, fallback, context);
  return {
    actions: [{ type: "send", text: RETRY_TEXT, options: question.data.options.map((option) => option.label) }],
    waitingAt: question.id,
  };
}

/** O que precisa ser arrumado antes de ligar o fluxo. Lista vazia = pode ligar. */
export function flowProblems(graph: FlowGraph): string[] {
  const problems: string[] = [];
  const starts = graph.nodes.filter((node) => node.type === "start");
  if (starts.length !== 1) problems.push("O fluxo precisa de exatamente um bloco de início.");
  const start = starts[0] as FlowStartNode | undefined;
  if (start?.data.trigger === "keyword" && start.data.keywords.every((word) => !word.trim()))
    problems.push("Coloque ao menos uma palavra-chave no início.");
  if (start && !nextNode(graph, start.id, null)) problems.push("Ligue o início ao primeiro passo.");
  for (const node of graph.nodes) {
    if ((node.type === "message" || node.type === "question") && !node.data.text.trim())
      problems.push(`Um bloco de ${node.type === "message" ? "mensagem" : "pergunta"} está sem texto.`);
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
    switch (raw.type) {
      case "start": {
        const trigger = (["first_contact", "keyword", "any_message"] as const).find((item) => item === data.trigger) ?? "first_contact";
        const keywords = Array.isArray(data.keywords) ? data.keywords.filter(isString) : [];
        nodes.push({ ...base, type: "start", data: { trigger, keywords } });
        break;
      }
      case "message":
        nodes.push({ ...base, type: "message", data: { text: isString(data.text) ? data.text : "" } });
        break;
      case "question": {
        const options = (Array.isArray(data.options) ? data.options : [])
          .filter((option): option is Record<string, unknown> => isRecord(option) && isString(option.id) && isString(option.label))
          .map((option) => ({ id: option.id as string, label: option.label as string }));
        nodes.push({ ...base, type: "question", data: { text: isString(data.text) ? data.text : "", options } });
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
