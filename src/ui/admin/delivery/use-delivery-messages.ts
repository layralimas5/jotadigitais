import { useMemo } from "react";
import {
  deleteDeliveryMessage,
  getMessageTemplates,
  listDeliveryMessages,
  saveDefaultDeliveryMessage,
  saveDeliveryMessage,
} from "@/application/admin-use-cases";
import { canUseStoreArea } from "@/domain/admin-user";
import type { DeliveryMessage, DeliveryMessageData } from "@/domain/delivery-message";
import { useViewAccess } from "../admin-view";
import { useAdminQuery, useMutation } from "../hooks";

/** A padrão ("Conta entregue", da Automação) ou uma das salvas, pelo id. */
export type MessageChoice = "default" | string;

export interface MessageOption {
  choice: MessageChoice;
  name: string;
  body: string;
}

/**
 * Mensagens de entrega: a padrão e as que o Jota salvou. Trocar a padrão mexe na Automação, então só aparece para quem
 * abre aquela tela; salvar e apagar as outras vale para quem cuida dos pedidos.
 */
export function useDeliveryMessages() {
  const templates = useAdminQuery(getMessageTemplates, "message-templates");
  const saved = useAdminQuery(listDeliveryMessages, "delivery-messages");
  const access = useViewAccess();
  const canChangeDefault = access !== null && canUseStoreArea(access, "automation");

  const create = useMutation((deps, data: DeliveryMessageData) => saveDeliveryMessage(deps, null, data));
  const update = useMutation((deps, id: string, data: DeliveryMessageData) => saveDeliveryMessage(deps, id, data));
  const remove = useMutation(async (deps, id: string) => {
    await deleteDeliveryMessage(deps, id);
    return true;
  });
  const setDefault = useMutation((deps, body: string) => saveDefaultDeliveryMessage(deps, body));

  const options = useMemo<MessageOption[]>(() => {
    if (templates.status !== "success") return [];
    const list: DeliveryMessage[] = saved.status === "success" ? saved.data : [];
    return [
      { choice: "default", name: "Padrão", body: templates.data.order_delivered },
      ...list.map((item) => ({ choice: item.id, name: item.name, body: item.body })),
    ];
  }, [templates, saved]);

  const pending = create.pending || update.pending || remove.pending || setDefault.pending;
  const error = create.error ?? update.error ?? remove.error ?? setDefault.error;

  return {
    status: templates.status === "success" ? ("success" as const) : templates.status,
    loadError: templates.status === "error" ? templates.error : null,
    savedError: saved.status === "error" ? saved.error : null,
    retry: () => {
      templates.reload();
      saved.reload();
    },
    options,
    canChangeDefault,
    pending,
    error,
    async create(data: DeliveryMessageData) {
      const result = await create.run(data);
      if (result) saved.reload();
      return result;
    },
    async update(id: string, data: DeliveryMessageData) {
      const result = await update.run(id, data);
      if (result) saved.reload();
      return result;
    },
    async remove(id: string) {
      const result = await remove.run(id);
      if (result) saved.reload();
      return result;
    },
    async setDefault(body: string) {
      const result = await setDefault.run(body);
      if (result) templates.reload();
      return result;
    },
    resetError() {
      create.reset();
      update.reset();
      remove.reset();
      setDefault.reset();
    },
  };
}
