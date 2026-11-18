import type {
  FlowCheck,
  FlowEdge,
  FlowGraph,
  FlowNode,
  FlowNodeType,
  FlowTrigger,
} from "../../supabase/functions/_shared/whatsapp-flow";

export {
  FLOW_LIMITS,
  OTHER_HANDLE,
  RETRY_TEXT,
  answerFlow,
  flowProblems,
  matchOption,
  optionHandle,
  parseFlowGraph,
  pickFlow,
  renderWithOptions,
  startFlow,
  startNodeOf,
  triggerMatches,
  type FlowAction,
  type FlowCheck,
  type FlowContactKind,
  type FlowContext,
  type FlowEdge,
  type FlowGraph,
  type FlowNode,
  type FlowNodeType,
  type FlowOption,
  type FlowPosition,
  type FlowStep,
  type FlowTrigger,
} from "../../supabase/functions/_shared/whatsapp-flow";

/** Um fluxo de Automação > Fluxos. Só os ligados rodam no WhatsApp. */
export interface WhatsAppFlow {
  id: string;
  name: string;
  enabled: boolean;
  graph: FlowGraph;
  updatedAt: string;
}

export interface WhatsAppFlowDraft {
  id?: string;
  name: string;
  enabled: boolean;
  graph: FlowGraph;
}

export const FLOW_NAME_MAX = 80;

export const FLOW_TRIGGER_LABEL: Record<FlowTrigger, string> = {
  first_contact: "Primeira mensagem do cliente",
  keyword: "Mensagem com palavra-chave",
  any_message: "Qualquer mensagem",
};

export const FLOW_CHECK_LABEL: Record<FlowCheck, string> = {
  is_customer: "É cliente (já comprou)?",
  is_affiliate: "É afiliado?",
  is_student: "É aluno?",
  business_hours: "Está no horário da loja?",
};

/** Nome e explicação de cada bloco, na paleta e no painel de edição. */
export const FLOW_NODE_INFO: Record<FlowNodeType, { label: string; hint: string }> = {
  start: { label: "Início", hint: "Quando o fluxo começa." },
  message: { label: "Mensagem", hint: "Envia um texto e segue para o próximo bloco." },
  question: { label: "Pergunta", hint: "Envia botões e segue pelo caminho que o cliente escolher." },
  condition: { label: "Condição", hint: "Segue por Sim ou Não conforme o cliente." },
  ai: { label: "IA assume", hint: "A partir daqui a IA conversa sozinha." },
  handoff: { label: "Chamar o Jota", hint: "Passa a conversa para você e avisa no celular." },
  end: { label: "Fim", hint: "Encerra o fluxo sem mandar mais nada." },
};

/** Blocos que o Jota pode adicionar (o início já vem em todo fluxo). */
export const ADDABLE_NODE_TYPES: readonly Exclude<FlowNodeType, "start">[] = ["message", "question", "condition", "ai", "handoff", "end"];

const randomId = (prefix: string) =>
  `${prefix}_${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10)}`;

export const newNodeId = () => randomId("n");
export const newOptionId = () => randomId("o");
export const newEdgeId = () => randomId("e");

export function createNode(type: Exclude<FlowNodeType, "start">, position: { x: number; y: number }): FlowNode {
  const id = newNodeId();
  switch (type) {
    case "message":
      return { id, type, position, data: { text: "" } };
    case "question":
      return {
        id,
        type,
        position,
        data: {
          text: "",
          options: [
            { id: newOptionId(), label: "Opção 1" },
            { id: newOptionId(), label: "Opção 2" },
          ],
        },
      };
    case "condition":
      return { id, type, position, data: { check: "is_customer" } };
    case "ai":
      return { id, type, position, data: {} };
    case "handoff":
      return { id, type, position, data: { note: "" } };
    case "end":
      return { id, type, position, data: {} };
  }
}

/** Fluxo vazio: só o início. */
export function blankGraph(): FlowGraph {
  return { nodes: [{ id: newNodeId(), type: "start", position: { x: 0, y: 0 }, data: { trigger: "keyword", keywords: [] } }], edges: [] };
}

const edge = (source: string, target: string, sourceHandle: string | null = null): FlowEdge => ({
  id: `e_${source}_${sourceHandle ?? "out"}_${target}`,
  source,
  sourceHandle,
  target,
});

/** Modelo pronto do atendimento da Jota Digitais: boas-vindas, menu e o caminho de cada opção. */
export function templateGraph(): FlowGraph {
  const nodes: FlowNode[] = [
    { id: "inicio", type: "start", position: { x: 0, y: 0 }, data: { trigger: "first_contact", keywords: [] } },
    {
      id: "boas_vindas",
      type: "message",
      position: { x: 0, y: 150 },
      data: { text: "Oi! Aqui é a Jota Digitais. Vendemos contas de TikTok, Instagram, YouTube e Facebook prontas para usar." },
    },
    {
      id: "menu",
      type: "question",
      position: { x: 0, y: 320 },
      data: {
        text: "Como posso te ajudar?",
        options: [
          { id: "comprar", label: "Quero comprar" },
          { id: "suporte", label: "Já comprei" },
          { id: "afiliado", label: "Ser afiliado" },
        ],
      },
    },
    { id: "ia_vendas", type: "ai", position: { x: -380, y: 560 }, data: {} },
    { id: "e_cliente", type: "condition", position: { x: 0, y: 560 }, data: { check: "is_customer" } },
    {
      id: "suporte_jota",
      type: "handoff",
      position: { x: -120, y: 760 },
      data: { note: "Cliente com compra pedindo suporte." },
    },
    {
      id: "sem_compra",
      type: "message",
      position: { x: 160, y: 760 },
      data: { text: "Não achei uma compra neste número. Me passa o código do pedido (começa com JD-) que eu confiro para você." },
    },
    { id: "ia_suporte", type: "ai", position: { x: 160, y: 930 }, data: {} },
    {
      id: "afiliado_msg",
      type: "message",
      position: { x: 400, y: 560 },
      data: { text: "Que bom! O programa de afiliados paga comissão por cada venda indicada. O Jota vai te explicar como funciona." },
    },
    { id: "afiliado_jota", type: "handoff", position: { x: 400, y: 740 }, data: { note: "Quer ser afiliado." } },
  ];
  const edges: FlowEdge[] = [
    edge("inicio", "boas_vindas"),
    edge("boas_vindas", "menu"),
    edge("menu", "ia_vendas", "opt:comprar"),
    edge("menu", "e_cliente", "opt:suporte"),
    edge("menu", "afiliado_msg", "opt:afiliado"),
    edge("menu", "ia_vendas", "other"),
    edge("e_cliente", "suporte_jota", "yes"),
    edge("e_cliente", "sem_compra", "no"),
    edge("sem_compra", "ia_suporte"),
    edge("afiliado_msg", "afiliado_jota"),
  ];
  return { nodes, edges };
}
