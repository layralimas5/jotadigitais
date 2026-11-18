import type { Edge } from "@xyflow/react";
import { optionHandle, type FlowGraph, type FlowNode } from "@/domain/whatsapp-flow";
import type { CanvasNode } from "./FlowNodeView";

export const toCanvasNodes = (graph: FlowGraph): CanvasNode[] =>
  graph.nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: node.position,
    data: node.data,
    // O início não sai do quadro: sem ele o fluxo não tem por onde começar.
    deletable: node.type !== "start",
  }));

export const toCanvasEdges = (graph: FlowGraph): Edge[] =>
  graph.edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, sourceHandle: edge.sourceHandle }));

export function toGraph(nodes: readonly CanvasNode[], edges: readonly Edge[]): FlowGraph {
  return {
    nodes: nodes.map((node) => ({ id: node.id, type: node.type, position: node.position, data: node.data }) as FlowNode),
    edges: edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, sourceHandle: edge.sourceHandle ?? null })),
  };
}

/** Ligações que saíam de uma opção apagada deixam de existir junto com ela. */
export function edgesWithoutRemovedOptions(edges: readonly Edge[], node: FlowNode): Edge[] {
  if (node.type !== "question") return [...edges];
  const handles = new Set(node.data.options.map((option) => optionHandle(option.id)));
  return edges.filter((edge) => edge.source !== node.id || !edge.sourceHandle?.startsWith("opt:") || handles.has(edge.sourceHandle));
}
