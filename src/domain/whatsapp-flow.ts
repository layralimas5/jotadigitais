import type { FlowCheck, FlowEdge, FlowGraph, FlowNode, FlowNodeType } from "../../supabase/functions/_shared/whatsapp-flow";

export {
  FLOW_LIMITS,
  OTHER_HANDLE,
  flowPlaybook,
  flowProblems,
  optionHandle,
  parseFlowGraph,
  renderWithOptions,
  type FlowCheck,
  type FlowEdge,
  type FlowGraph,
  type FlowNode,
  type FlowNodeType,
  type FlowOption,
  type FlowPosition,
} from "../../supabase/functions/_shared/whatsapp-flow";

/** Um fluxo de WhatsApp > Fluxos. Só os ligados entram no roteiro da IA. */
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

export const FLOW_CHECK_LABEL: Record<FlowCheck, string> = {
  is_customer: "É cliente (já comprou)?",
  is_affiliate: "É afiliado?",
  is_student: "É aluno?",
  business_hours: "Está no horário da loja?",
};

/** Nome e explicação de cada bloco, na paleta e no próprio bloco. */
export const FLOW_NODE_INFO: Record<FlowNodeType, { label: string; hint: string }> = {
  start: { label: "Início", hint: "Começo do atendimento." },
  customer: { label: "Mensagem do cliente", hint: "O que o cliente diz nesse ponto. A IA reconhece pela ideia, não pela frase exata." },
  message: { label: "Mensagem", hint: "A IA manda este texto como está escrito." },
  question: { label: "Pergunta", hint: "A IA pergunta com botões e segue pelo caminho que o cliente escolher." },
  condition: { label: "Condição", hint: "Segue por Sim ou Não conforme o cliente." },
  ai: { label: "Conversa livre", hint: "A IA conversa livre a partir daqui, com as regras e perguntas frequentes." },
  handoff: { label: "Chamar o Jota", hint: "Passa a conversa para você e avisa no celular." },
  end: { label: "Fim", hint: "Encerra este caminho sem mandar mais nada." },
};

/** Blocos que o Jota pode adicionar (o início já vem em todo fluxo). */
export const ADDABLE_NODE_TYPES: readonly Exclude<FlowNodeType, "start">[] = ["customer", "message", "question", "condition", "ai", "handoff", "end"];

const randomId = (prefix: string) =>
  `${prefix}_${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10)}`;

export const newNodeId = () => randomId("n");
export const newOptionId = () => randomId("o");
export const newEdgeId = () => randomId("e");

export function createNode(type: Exclude<FlowNodeType, "start">, position: { x: number; y: number }): FlowNode {
  const id = newNodeId();
  switch (type) {
    case "customer":
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
  return { nodes: [{ id: newNodeId(), type: "start", position: { x: 0, y: 0 }, data: {} }], edges: [] };
}

const edge = (source: string, target: string, sourceHandle: string | null = null): FlowEdge => ({
  id: `e_${source}_${sourceHandle ?? "out"}_${target}`,
  source,
  sourceHandle,
  target,
});

/** Modelo pronto do atendimento da Jota Digitais: boas-vindas, menu, o caminho de cada opção e o pedido de desconto. */
export function templateGraph(): FlowGraph {
  const nodes: FlowNode[] = [
    { id: "inicio", type: "start", position: { x: 0, y: 0 }, data: {} },
    { id: "pede_desconto", type: "customer", position: { x: 420, y: 150 }, data: { text: "Pede desconto ou pergunta se faz mais barato" } },
    { id: "desconto_jota", type: "handoff", position: { x: 420, y: 330 }, data: { note: "Pediu desconto." } },
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
      position: { x: 420, y: 560 },
      data: { text: "Que bom! O programa de afiliados paga comissão por cada venda indicada. O Jota vai te explicar como funciona." },
    },
    { id: "afiliado_jota", type: "handoff", position: { x: 420, y: 740 }, data: { note: "Quer ser afiliado." } },
  ];
  const edges: FlowEdge[] = [
    edge("inicio", "boas_vindas"),
    edge("inicio", "pede_desconto"),
    edge("pede_desconto", "desconto_jota"),
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
