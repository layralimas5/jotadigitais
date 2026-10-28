import { useCallback, useState } from "react";
import { container } from "@/app/container";
import { lookupMyData, openDataRequest } from "@/application/privacy-use-cases";
import { ValidationError, type PrivacyAccess } from "@/application/schemas";
import type { OpenedDataRequest, SubjectData } from "@/domain/privacy";

const { store } = container;

type MyDataState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string; fieldErrors: Record<string, string> }
  | { status: "ready"; access: PrivacyAccess; data: SubjectData };

const messageOf = (error: unknown) => (error instanceof Error ? error.message : "Algo deu errado. Tente de novo.");
const fieldErrorsOf = (error: unknown) => (error instanceof ValidationError ? error.fieldErrors : {});

/** Meus dados: entrar com WhatsApp ou e-mail + código do pedido, ver tudo e abrir solicitações. Nada fica salvo no navegador. */
export function useMyData() {
  const [state, setState] = useState<MyDataState>({ status: "idle" });

  const enter = useCallback(async (raw: { contact: string; orderCode: string }) => {
    setState({ status: "loading" });
    try {
      const { access, data } = await lookupMyData(store, raw);
      setState({ status: "ready", access, data });
    } catch (error) {
      console.error(error);
      setState({ status: "error", message: messageOf(error), fieldErrors: fieldErrorsOf(error) });
    }
  }, []);

  const leave = useCallback(() => setState({ status: "idle" }), []);

  /** Abre a solicitação e recarrega os dados para ela aparecer na lista. */
  const request = useCallback(
    async (raw: { kind: string; details: string }): Promise<OpenedDataRequest> => {
      if (state.status !== "ready") throw new Error("Entre com o WhatsApp ou e-mail e o código do pedido primeiro.");
      const opened = await openDataRequest(store, state.access, raw);
      const { data } = await lookupMyData(store, state.access);
      setState({ status: "ready", access: state.access, data });
      return opened;
    },
    [state],
  );

  return { state, enter, leave, request };
}
