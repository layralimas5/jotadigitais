import { ArrowLeft, AtSign, Compass, IdCard, Mail, MapPin, MessageCircle, Pencil, Target, UserPlus, type LucideIcon } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { listCustomers } from "@/application/admin-use-cases";
import { formatDocument, type CustomerSummary } from "@/domain/customer";
import { LEAD_SOURCE_LABEL } from "@/domain/lead";
import { formatBRL } from "@/domain/money";
import { PLATFORM_LABEL } from "@/domain/platform";
import { ButtonLink, buttonClasses } from "@/ui/components/Button";
import { PlatformGlyph } from "@/ui/components/PlatformGlyph";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { LoadingBlock, PageHeader } from "../components/AdminUi";
import { OrderStatusBadge } from "../components/OrderStatusBadge";
import { useAdminQuery, useMessageTemplates } from "../hooks";
import { formatDate } from "../lib/dates";
import { personMessage } from "../lib/messages";
import { whatsappChatUrl } from "../lib/whatsapp";

function BackLink() {
  return (
    <Link to="/admin/clientes" className="inline-flex items-center gap-2 text-sm text-mist hover:text-white">
      <ArrowLeft aria-hidden className="size-4" /> Voltar para os clientes
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface/60 p-4">
      <dt className="text-xs text-mist">{label}</dt>
      <dd className="mt-1 font-display text-xl font-semibold text-white tabular-nums">{value}</dd>
    </div>
  );
}

/** Cliente que só existe pelos pedidos abre o cadastro já preenchido com o que o pedido trouxe. */
function recordLink(customer: CustomerSummary): string {
  if (customer.record) return `/admin/clientes/cadastro/${customer.record.id}`;
  const params = new URLSearchParams({ nome: customer.name, email: customer.email ?? "", whatsapp: customer.whatsapp ?? "" });
  return `/admin/clientes/novo?${params.toString()}`;
}

function ContactActions({ customer }: { customer: CustomerSummary }) {
  const templates = useMessageTemplates();
  return (
    <div className="flex flex-wrap gap-2">
      {customer.whatsapp && (
        <a
          href={whatsappChatUrl(customer.whatsapp, personMessage(templates, "customer_hello", customer.name))}
          target="_blank"
          rel="noreferrer"
          className={buttonClasses({ className: "bg-[#25d366] shadow-none hover:bg-[#3ee07c] hover:shadow-none" })}
        >
          <MessageCircle aria-hidden className="size-4" /> WhatsApp
        </a>
      )}
      {customer.email && (
        <a href={`mailto:${customer.email}`} className={buttonClasses({ variant: "secondary" })}>
          <Mail aria-hidden className="size-4" /> E-mail
        </a>
      )}
      <ButtonLink to={recordLink(customer)} variant="secondary">
        {customer.record ? <Pencil aria-hidden className="size-4" /> : <UserPlus aria-hidden className="size-4" />}
        {customer.record ? "Editar cadastro" : "Completar cadastro"}
      </ButtonLink>
    </div>
  );
}

interface ProfileDetail {
  icon: LucideIcon;
  label: string;
  value: string;
}

/** Dados extras do cadastro manual. Cadastros antigos podem não ter esses campos. */
function recordDetailsOf(customer: CustomerSummary): ProfileDetail[] {
  const record = customer.record;
  if (!record) return [];
  const location = [record.city, record.state].filter(Boolean).join(" / ");
  const details: (ProfileDetail | null)[] = [
    record.document ? { icon: IdCard, label: "Documento", value: formatDocument(record.document) } : null,
    location ? { icon: MapPin, label: "Localização", value: location } : null,
    record.source ? { icon: Compass, label: "Chegou por", value: LEAD_SOURCE_LABEL[record.source] } : null,
    record.interest ? { icon: Target, label: "Interesse", value: PLATFORM_LABEL[record.interest] } : null,
  ];
  return details.filter((detail): detail is ProfileDetail => detail !== null);
}

function CustomerProfile({ customer }: { customer: CustomerSummary }) {
  const details = recordDetailsOf(customer);
  return (
    <>
      <BackLink />
      <div className="mt-4">
        <PageHeader
          title={customer.name}
          description={customer.since ? `Cliente desde ${formatDate(customer.since)}.` : undefined}
          action={<ContactActions customer={customer} />}
        />
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Compras" value={String(customer.purchases)} />
        <Stat label="Total gasto" value={formatBRL(customer.totalSpent)} />
        <Stat label="Pedidos em aberto" value={String(customer.openOrders)} />
        <Stat label="Último pedido" value={customer.lastOrderAt ? formatDate(customer.lastOrderAt) : "Nenhum"} />
      </dl>

      {(customer.email || customer.instagram || customer.notes || details.length > 0) && (
        <section aria-label="Cadastro" className="mt-6 rounded-3xl border border-line bg-surface/60 p-5 text-sm">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-fog">
            {customer.email && (
              <li className="inline-flex items-center gap-2">
                <Mail aria-hidden className="size-4 text-mist" /> {customer.email}
              </li>
            )}
            {customer.instagram && (
              <li className="inline-flex items-center gap-2">
                <AtSign aria-hidden className="size-4 text-mist" /> {customer.instagram}
              </li>
            )}
          </ul>
          {details.length > 0 && (
            <dl className="mt-3 grid gap-3 border-t border-line pt-3 sm:grid-cols-2 lg:grid-cols-4">
              {details.map((detail) => (
                <div key={detail.label} className="flex items-start gap-2">
                  <detail.icon aria-hidden className="mt-0.5 size-4 shrink-0 text-mist" />
                  <div>
                    <dt className="text-xs text-mist">{detail.label}</dt>
                    <dd className="text-fog">{detail.value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          )}
          {customer.notes && <p className="mt-3 border-t border-line pt-3 whitespace-pre-line text-mist">{customer.notes}</p>}
        </section>
      )}

      <section aria-labelledby="pedidos-title" className="mt-8">
        <h2 id="pedidos-title" className="font-display text-lg font-semibold text-white">
          Pedidos
        </h2>
        {customer.orders.length === 0 ? (
          <p className="mt-3 rounded-3xl border border-dashed border-line-strong p-6 text-center text-sm text-mist">
            Nenhum pedido pelo site ainda. Quando comprar com o e-mail {customer.email ?? "cadastrado"}, o pedido aparece aqui.
          </p>
        ) : (
          <>
            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-3xl border border-line">
              {customer.orders.map((order) => (
                <li key={order.code} className="flex flex-col gap-3 bg-surface/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-medium text-white">
                      <PlatformGlyph platform={order.accountPlatform} className="size-3.5" />
                      {order.accountHandle}
                      <span className="font-mono text-xs text-mist">{order.code}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-mist">
                      {PLATFORM_LABEL[order.accountPlatform]} · {formatDate(order.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <OrderStatusBadge order={order} />
                    <span className="font-semibold text-white tabular-nums">{formatBRL(order.total)}</span>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-mist">
              Para mudar o status de um pedido, use a aba{" "}
              <Link to="/admin/pedidos" className="text-electric-soft underline-offset-4 hover:underline">
                Pedidos
              </Link>
              .
            </p>
          </>
        )}
      </section>
    </>
  );
}

export default function CustomerDetailPage() {
  const { key = "" } = useParams();
  const customers = useAdminQuery(listCustomers, "admin-customers");

  if (customers.status === "loading") return <LoadingBlock />;
  if (customers.status === "error") return <ErrorState message={customers.error.message} onRetry={customers.reload} />;

  const customer = customers.data.find((item) => item.key === key.trim().toLowerCase());
  if (!customer) {
    return (
      <EmptyState
        title="Cliente não encontrado"
        description="O cadastro pode ter sido apagado ou o pedido saiu do banco."
        action={<BackLink />}
      />
    );
  }
  return <CustomerProfile customer={customer} />;
}
