import type { AdminUser } from "./admin-user";

/** Como a desenvolvedora (TI) vê cada usuário: o cadastro mais o estado do acesso. */
export interface AccessUser extends AdminUser {
  /** Só dígitos, com DDD; usado para mandar o acesso pelo WhatsApp. */
  whatsapp: string | null;
  /** Verificação em duas etapas ligada (app autenticador confirmado). */
  mfaEnabled: boolean;
  /** Sessões abertas há menos de 7 dias (o prazo que o sistema aceita). */
  activeSessions: number;
}

/** O que a TI muda no cadastro. O e-mail novo vale na hora, sem confirmação. */
export interface AccessProfileUpdate {
  name: string;
  email: string;
  whatsapp: string | null;
}

/** Endereço do painel que vai na mensagem de acesso. */
export const panelUrlOf = (siteUrl: string) => `${siteUrl.replace(/\/+$/, "")}/admin`;

interface AccessMessageInput {
  name: string | null;
  email: string;
  /** Nula quando só se manda o link (a senha continua a mesma). */
  password: string | null;
  siteUrl: string;
  storeName: string;
}

/** Mensagem pronta para mandar pelo WhatsApp depois de criar ou trocar a senha de alguém. */
export function accessMessage({ name, email, password, siteUrl, storeName }: AccessMessageInput): string {
  const greeting = name ? `Oi, ${name.trim().split(/\s+/)[0]}!` : "Oi!";
  return [
    `${greeting} Aqui está o seu acesso ao sistema da ${storeName}:`,
    "",
    `Link: ${panelUrlOf(siteUrl)}`,
    `E-mail: ${email}`,
    password ? `Senha provisória: ${password}` : "Senha: a mesma que você já usa (se esqueceu, me avisa que eu troco).",
    "",
    password ? "No primeiro acesso, troque a senha em Configurações. Qualquer coisa, me chama." : "Qualquer coisa, me chama.",
  ].join("\n");
}
