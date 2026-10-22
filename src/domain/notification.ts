import { toLocalIsoDate } from "./finance";
import { followUpStatusOf, type Lead } from "./lead";
import type { Order } from "./order";

/**
 * O sininho junta três origens:
 * - `order`: pedido novo do site, gravado pelo banco na hora em que entra;
 * - `news`: novidades do sistema, publicadas por quem cuida dele;
 * - `privacy`: solicitação LGPD aberta em Meus dados, gravada pelo banco;
 * - `reminder`: lembretes calculados na hora a partir dos pedidos e do CRM.
 */
export type NotificationKind = "order" | "news" | "privacy" | "security" | "reminder";

export interface AppNotification {
  /** Identifica a notificação para apagar: o mesmo aviso não volta depois de apagado. */
  key: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  /** Tela do painel que resolve o aviso. */
  link: string | null;
  createdAt: string;
}

/** Notificação guardada no banco (pedido novo, novidade ou solicitação LGPD). */
export interface StoredNotification {
  id: string;
  kind: Extract<NotificationKind, "order" | "news" | "privacy" | "security">;
  title: string;
  body: string | null;
  link: string | null;
  createdAt: string;
}

export const storedNotificationKey = (id: string) => `notification:${id}`;

const EXPIRING_SOON_MS = 30 * 60_000;

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/** Lembretes do que está esperando o Jota agir. A chave muda quando o motivo muda, então o aviso volta se precisar. */
export function remindersOf(orders: readonly Order[], leads: readonly Lead[], now: Date = new Date()): AppNotification[] {
  const today = toLocalIsoDate(now);
  const toDeliver: AppNotification[] = orders
    .filter((order) => order.status === "paid")
    .map((order) => ({
      key: `reminder:deliver:${order.code}`,
      kind: "reminder",
      title: `Entregar a conta ${order.accountHandle}`,
      body: `Pedido ${order.code} de ${order.customer.name} está pago e esperando a entrega.`,
      link: "/admin/pedidos",
      createdAt: order.createdAt,
    }));

  const expiring: AppNotification[] = orders
    .filter((order) => {
      const left = new Date(order.expiresAt).getTime() - now.getTime();
      return order.status === "awaiting_payment" && left > 0 && left <= EXPIRING_SOON_MS;
    })
    .map((order) => ({
      key: `reminder:expiring:${order.code}`,
      kind: "reminder",
      title: `Reserva de ${order.accountHandle} vence em breve`,
      body: `${order.customer.name} ainda não pagou o pedido ${order.code}. Sem pagamento, a conta volta para a vitrine.`,
      link: "/admin/pedidos",
      createdAt: order.createdAt,
    }));

  const due = leads.filter((lead) => {
    const status = followUpStatusOf(lead, today);
    return status === "overdue" || status === "today";
  });
  const followUps: AppNotification[] = due.length
    ? [
        {
          key: `reminder:followups:${today}`,
          kind: "reminder",
          title: `${due.length} ${plural(due.length, "retorno", "retornos")} do CRM para hoje`,
          body: due
            .slice(0, 3)
            .map((lead) => lead.name)
            .join(", ")
            .concat(due.length > 3 ? ` e mais ${due.length - 3}` : ""),
          link: "/admin/crm",
          createdAt: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(),
        },
      ]
    : [];

  return [...toDeliver, ...expiring, ...followUps];
}

/** O que aparece no sininho: tudo menos o que já foi apagado, do mais novo para o mais antigo. */
export function visibleNotifications(
  stored: readonly StoredNotification[],
  reminders: readonly AppNotification[],
  dismissed: ReadonlySet<string>,
): AppNotification[] {
  const fromStore: AppNotification[] = stored.map((item) => ({ ...item, key: storedNotificationKey(item.id) }));
  return [...fromStore, ...reminders]
    .filter((item) => !dismissed.has(item.key))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
