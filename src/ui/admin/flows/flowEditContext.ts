import { createContext, useContext } from "react";
import type { FlowNode } from "@/domain/whatsapp-flow";

/** O que um bloco do quadro pode fazer consigo mesmo: editar o texto ali dentro ou se apagar. */
export interface FlowEditActions {
  updateNode: (id: string, data: FlowNode["data"]) => void;
  deleteNode: (id: string) => void;
}

export const FlowEditContext = createContext<FlowEditActions>({ updateNode: () => undefined, deleteNode: () => undefined });

export const useFlowEdit = () => useContext(FlowEditContext);
