import type { ReactNode } from "react";
import { LEGAL_DOCUMENTS } from "@/application/legal-documents";
import { PAYMENT_PLAN_LABEL } from "@/domain/payment";
import { formatDocument } from "@/domain/customer";
import { LEAD_SOURCE_LABEL } from "@/domain/lead";
import { formatBRL } from "@/domain/money";
import type { Order } from "@/domain/order";
import { PLATFORM_LABEL } from "@/domain/platform";
import { DATA_REQUEST_KIND_VIEW, DATA_REQUEST_STATUS_LABEL, type SubjectData } from "@/domain/privacy";

const ORDER_STATUS_LABEL: Record<Order["status"], string> = {
  awaiting_payment: "Aguardando pagamento",
  paid: "Pago, aguardando entrega",
  delivered: "Entregue",
  canceled: "Cancelado",
};


const formatDateTime = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
const formatBirth = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR");

type Row = [label: string, value: ReactNode | null];

function Fields({ rows }: { rows: Row[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {rows
        .filter(([, value]) => value !== null && value !== "")
        .map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-mist">{label}</dt>
            <dd className="mt-0.5 break-words text-white">{value}</dd>
          </div>
        ))}
    </dl>
  );
}

function Group({ id, title, empty, children }: { id: string; title: string; empty: string | null; children: ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="font-display text-base font-semibold text-white">
        {title}
      </h3>
      {empty ? <p className="mt-3 text-sm text-mist">{empty}</p> : <div className="mt-3 space-y-3">{children}</div>}
    </section>
  );
}

const card = "rounded-2xl border border-line bg-surface/60 p-4 sm:p-5";

export function SubjectDataView({ data }: { data: SubjectData }) {
  return (
    <div className="space-y-10">
      <Group id="dados-pedidos" title="Pedidos e ficha de compra" empty={data.orders.length ? null : "Nenhum pedido ligado a este contato."}>
        {data.orders.map((order) => (
          <article key={order.code} className={card}>
            <p className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-mono font-semibold text-white">{order.code}</span>
              <span className="text-xs text-mist">{ORDER_STATUS_LABEL[order.status]}</span>
            </p>
            <div className="mt-4">
              <Fields
                rows={[
                  ["Conta", `${order.accountHandle} (${PLATFORM_LABEL[order.accountPlatform]})`],
                  ["Valor", `${formatBRL(order.total)} · ${PAYMENT_PLAN_LABEL[order.paymentMethod]}`],
                  ["Pedido em", formatDateTime(order.createdAt)],
                  ["Entregue em", order.deliveredAt ? formatDateTime(order.deliveredAt) : null],
                  ["Nome", order.customer.name],
                  ["E-mail", order.customer.email],
                  ["WhatsApp", order.customer.whatsapp],
                  ["CPF ou CNPJ", order.customer.document ? formatDocument(order.customer.document) : null],
                  ["Nascimento", order.customer.birthDate ? formatBirth(order.customer.birthDate) : null],
                  ["Instagram", order.customer.instagram],
                  ["Cidade", order.customer.city ? `${order.customer.city}/${order.customer.state ?? ""}` : null],
                ]}
              />
            </div>
          </article>
        ))}
      </Group>

      <Group id="dados-cadastro" title="Cadastro feito pelo atendimento" empty={data.customers.length ? null : "Não há cadastro manual com este contato."}>
        {data.customers.map((customer) => (
          <article key={customer.createdAt} className={card}>
            <Fields
              rows={[
                ["Nome", customer.name],
                ["E-mail", customer.email],
                ["WhatsApp", customer.whatsapp],
                ["CPF ou CNPJ", customer.document ? formatDocument(customer.document) : null],
                ["Nascimento", customer.birthDate ? formatBirth(customer.birthDate) : null],
                ["Instagram", customer.instagram],
                ["Cidade", customer.city ? `${customer.city}/${customer.state ?? ""}` : null],
                ["Como chegou", customer.source ? LEAD_SOURCE_LABEL[customer.source] : null],
                ["Interesse", customer.interest ? PLATFORM_LABEL[customer.interest] : null],
                ["Anotações do atendimento", customer.notes],
                ["Cadastrado em", formatDateTime(customer.createdAt)],
              ]}
            />
          </article>
        ))}
      </Group>

      <Group id="dados-aceites" title="Aceites registrados" empty={data.consents.length ? null : "Nenhum aceite registrado. Pedidos anteriores a 21/10/2026 não guardavam essa prova."}>
        {data.consents.map((consent) => (
          <article key={`${consent.orderCode}-${consent.slug}`} className={card}>
            <Fields
              rows={[
                ["Documento", `${LEGAL_DOCUMENTS[consent.slug].title}, versão ${consent.version}`],
                ["Pedido", consent.orderCode],
                ["Aceito em", formatDateTime(consent.acceptedAt)],
                ["IP", consent.ipAddress],
                ["Impressão digital (SHA-256)", <span className="font-mono text-xs">{consent.sha256}</span>],
                ["Navegador", consent.userAgent],
              ]}
            />
          </article>
        ))}
      </Group>

      <Group id="dados-solicitacoes" title="Suas solicitações" empty={data.requests.length ? null : "Você ainda não abriu nenhuma solicitação."}>
        {data.requests.map((request) => (
          <article key={request.protocol} className={card}>
            <p className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-mono font-semibold text-white">{request.protocol}</span>
              <span className="text-xs text-mist">{DATA_REQUEST_STATUS_LABEL[request.status]}</span>
            </p>
            <div className="mt-4">
              <Fields
                rows={[
                  ["Pedido", DATA_REQUEST_KIND_VIEW[request.kind].label],
                  ["Aberta em", formatDateTime(request.createdAt)],
                  [request.status === "open" ? "Resposta até" : "Respondida em", formatDateTime(request.resolvedAt ?? request.dueAt)],
                  ["Sua mensagem", request.details],
                  ["Resposta", request.response],
                ]}
              />
            </div>
          </article>
        ))}
      </Group>
    </div>
  );
}
