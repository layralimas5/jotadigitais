import type { StaffAccess } from "./admin-user";
import type { StoredNotification } from "./notification";

/** Tipos de aviso que podem chegar no celular. Mesma lista da constraint de push_preferences.kinds. */
export type PushKind = StoredNotification["kind"];

export interface PushKindOption {
  kind: PushKind;
  label: string;
  description: string;
}

export const PUSH_KIND_OPTIONS: readonly PushKindOption[] = [
  { kind: "order", label: "Venda nova", description: "Alguém fez um pedido no site." },
  { kind: "payment", label: "Pagamento confirmado", description: "O cartão ou o Pix caiu e a conta está pronta para entregar." },
  { kind: "support", label: "Suporte e pendências", description: "Chamado novo, resposta ou algo esperando você aprovar." },
  { kind: "security", label: "Segurança", description: "Login de aparelho novo e tentativas bloqueadas." },
  { kind: "privacy", label: "Privacidade (LGPD)", description: "Um cliente pediu os dados dele em Meus dados." },
  { kind: "news", label: "Novidades do sistema", description: "Uma função nova entrou no painel." },
];

const only = (kinds: readonly PushKind[]) => PUSH_KIND_OPTIONS.filter((option) => kinds.includes(option.kind));

/**
 * O que cada papel pode receber no celular (mesma regra da função push-send):
 * o Jota recebe tudo; a desenvolvedora não cuida da loja, então só suporte e segurança;
 * o ajudante só o que o sininho dele mostra, venda nova e pagamento, se tiver Pedidos.
 */
export function pushKindsFor(access: StaffAccess): readonly PushKindOption[] {
  if (access.role === "admin") return PUSH_KIND_OPTIONS;
  if (access.role === "developer") return only(["support", "security"]);
  return access.permissions.includes("orders") ? only(["order", "payment"]) : [];
}

/**
 * Situação do aviso neste aparelho:
 * - `unsupported`: navegador sem push (ou modo de demonstração sem servidor);
 * - `needs-install`: iPhone/iPad no Safari: o push só existe com o painel adicionado à Tela de Início;
 * - `blocked`: a pessoa negou a permissão; só volta pelos ajustes do navegador;
 * - `off` / `on`: pode ligar / já está ligado.
 */
export type PushDeviceStatus = "unsupported" | "needs-install" | "blocked" | "off" | "on";
