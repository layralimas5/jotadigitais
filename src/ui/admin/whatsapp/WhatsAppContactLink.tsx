import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { whatsappChatUrl } from "../lib/whatsapp";
import { conversationLink } from "./links";
import { useWhatsAppConversation } from "./WhatsAppAttention";

interface WhatsAppContactLinkProps {
  phone: string;
  /** Mensagem pronta para quando não há conversa no painel e o link abre o WhatsApp do aparelho. */
  text?: string;
  className?: string;
  /** Rótulo acessível quando o conteúdo visível é só "WhatsApp". */
  label?: string;
  children: ReactNode;
}

/**
 * "Abrir no WhatsApp" de Pedidos e Clientes: se o cliente já conversou com o número oficial, abre a conversa do
 * painel (histórico, IA, resposta pelo número da loja). Senão, abre o WhatsApp do aparelho com a mensagem pronta.
 */
export function WhatsAppContactLink({ phone, text, className, label, children }: WhatsAppContactLinkProps) {
  const conversation = useWhatsAppConversation(phone);
  if (conversation) {
    return (
      <Link to={conversationLink(conversation)} className={className} aria-label={label ? `${label} (conversa no painel)` : undefined} title="Abrir a conversa no painel">
        {children}
      </Link>
    );
  }
  return (
    <a href={whatsappChatUrl(phone, text)} target="_blank" rel="noreferrer" className={className} aria-label={label}>
      {children}
    </a>
  );
}
