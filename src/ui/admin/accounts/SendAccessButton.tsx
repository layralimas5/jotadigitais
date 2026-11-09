import { KeyRound } from "lucide-react";
import { Link } from "react-router-dom";
import { findAccountAccess } from "@/application/admin-use-cases";
import type { MessageTemplates } from "@/domain/message-template";
import type { Order } from "@/domain/order";
import { buttonClasses } from "@/ui/components/Button";
import { useAdminQuery } from "../hooks";
import { deliveryMessage } from "../lib/messages";
import { whatsappChatUrl } from "../lib/whatsapp";

/**
 * Pedido pago: abre o WhatsApp de quem comprou com a mensagem "Conta entregue" já com o e-mail e a senha da conta
 * (cadastrados na ficha dela). Sem login cadastrado, avisa e leva para a ficha.
 */
export function SendAccessButton({ order, templates }: { order: Order; templates: MessageTemplates }) {
  const { accountId } = order;
  const access = useAdminQuery((deps) => (accountId ? findAccountAccess(deps, accountId) : Promise.resolve(null)), `order-access:${order.code}`);
  if (!order.customer.whatsapp) return null;
  if (access.status === "loading") {
    return (
      <p role="status" className="text-xs text-mist sm:mr-auto sm:self-center">
        Buscando o e-mail e a senha da conta…
      </p>
    );
  }
  const data = access.status === "success" ? access.data : null;
  if (access.status === "error") console.error("Não foi possível buscar o e-mail e a senha da conta", access.error);
  const missing = data === null || data.password === null;
  return (
    <div className="flex flex-col gap-1.5 sm:mr-auto">
      <a
        href={whatsappChatUrl(order.customer.whatsapp, deliveryMessage(templates, order, data))}
        target="_blank"
        rel="noreferrer"
        className={buttonClasses({ size: "lg", className: "bg-[#25d366] text-ink shadow-none hover:bg-[#3be07a] hover:shadow-none" })}
      >
        <KeyRound aria-hidden className="size-4" /> Enviar e-mail e senha no WhatsApp
      </a>
      {missing && (
        <p className="text-xs text-amber-200">
          {access.status === "error"
            ? "Não deu para buscar o login da conta; a mensagem vai sem ele."
            : data === null
              ? "Conta sem e-mail cadastrado: a mensagem vai sem o login. "
              : "Conta sem senha cadastrada: a mensagem vai só com o e-mail. "}
          {accountId && access.status !== "error" && (
            <Link to={`/admin/contas/${accountId}`} className="text-electric-soft underline-offset-4 hover:underline">
              Preencher na ficha
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
