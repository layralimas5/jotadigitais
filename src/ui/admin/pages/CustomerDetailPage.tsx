import {
  ArrowLeft,
  AtSign,
  Cake,
  Compass,
  Handshake,
  IdCard,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Target,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { listCustomers, listPartners } from "@/application/admin-use-cases";
import { ageOn } from "@/domain/brazil";
import { formatDocument, type CustomerSummary } from "@/domain/customer";
import { REVENUE_CATEGORY_LABEL, toLocalIsoDate } from "@/domain/finance";
import { LEAD_SOURCE_LABEL } from "@/domain/lead";
import { formatBRL } from "@/domain/money";
import type { Partner } from "@/domain/partner";
import { PLATFORM_LABEL } from "@/domain/platform";
import { matchReferralPartner } from "@/domain/referral";
import { ButtonLink, buttonClasses } from "@/ui/components/Button";
import { PlatformGlyph } from "@/ui/components/PlatformGlyph";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { LoadingBlock, PageHeader } from "../components/AdminUi";
import { OrderStatusBadge } from "../components/OrderStatusBadge";
import { useAdminQuery, useMessageTemplates } from "../hooks";
import { formatDate, formatIsoDate } from "../lib/dates";
import { personMessage } from "../lib/messages";
import { formatPhone, whatsappChatUrl } from "../lib/whatsapp";

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

function ContactActions({ customer }: { customer: CustomerSummary }) {
  const templates = useMessageTemplates();
  const { record } = customer;
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
      {/* Cliente do site só é visto: a ficha é a que ele preencheu no checkout. */}
      {record && (
        <>
          <ButtonLink to={`/admin/clientes/cadastro/${record.id}`} variant="secondary">
            <Pencil aria-hidden className="size-4" /> Editar ficha
          </ButtonLink>
          <ButtonLink to={`/admin/financeiro/receitas/nova?cliente=${encodeURIComponent(record.id)}`} variant="secondary">
            <Plus aria-hidden className="size-4" /> Lançar venda
          </ButtonLink>
        </>
      )}
    </div>
  );
}

interface SheetRow {
  icon: LucideIcon;
  label: string;
  value: string | null;
  /** Abre outra tela do painel (ex.: o parceiro que indicou). */
  to?: string;
}

/** "1992-03-15" vira "15/03/1992 (34 anos)". */
function birthLabel(birthDate: string): string {
  const [year, month, day] = birthDate.split("-");
  return `${day}/${month}/${year} (${ageOn(birthDate, toLocalIsoDate(new Date()))} anos)`;
}

function referralRow(customer: CustomerSummary, partners: readonly Partner[]): SheetRow | null {
  const { source, referredBy } = customer.sheet;
  if (source !== "referral") return null;
  const partner = matchReferralPartner(referredBy, partners);
  return {
    icon: Handshake,
    label: partner ? "Indicado pelo parceiro" : "Indicado por",
    value: partner?.name ?? referredBy,
    to: partner ? `/admin/parceiros/${partner.id}` : undefined,
  };
}

function sheetRowsOf(customer: CustomerSummary, partners: readonly Partner[]): SheetRow[] {
  const { sheet, record } = customer;
  const location = [sheet.city, sheet.state].filter(Boolean).join(" / ");
  const rows: SheetRow[] = [
    { icon: IdCard, label: "CPF/CNPJ", value: sheet.document ? formatDocument(sheet.document) : null },
    { icon: Cake, label: "Nascimento", value: sheet.birthDate ? birthLabel(sheet.birthDate) : null },
    { icon: Mail, label: "E-mail", value: customer.email },
    { icon: Phone, label: "WhatsApp", value: customer.whatsapp ? formatPhone(customer.whatsapp) : null },
    { icon: AtSign, label: "Instagram", value: sheet.instagram },
    { icon: MapPin, label: "Cidade", value: location || null },
    { icon: Compass, label: "Chegou por", value: sheet.source ? LEAD_SOURCE_LABEL[sheet.source] : null },
  ];
  const referral = referralRow(customer, partners);
  if (referral) rows.push(referral);
  if (record) rows.push({ icon: Target, label: "Interesse", value: record.interest ? PLATFORM_LABEL[record.interest] : null });
  return rows;
}

function sheetDescription(customer: CustomerSummary): string {
  if (customer.origin === "manual") return "Cadastro manual, feito aqui no painel.";
  if (customer.sheet.document) return "Preenchida pelo cliente no checkout do site. Só leitura.";
  return "Comprou antes da ficha completa no checkout: só há os dados do pedido.";
}

function CustomerSheet({ customer, partners }: { customer: CustomerSummary; partners: readonly Partner[] }) {
  const rows = sheetRowsOf(customer, partners);
  return (
    <section aria-labelledby="ficha-title" className="mt-6 rounded-3xl border border-line bg-surface/60 p-5 sm:p-6">
      <h2 id="ficha-title" className="font-display text-base font-semibold text-white">
        Ficha do cliente
      </h2>
      <p className="mt-1 text-xs text-mist">{sheetDescription(customer)}</p>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => (
          <div key={row.label} className="flex min-w-0 items-start gap-2.5">
            <row.icon aria-hidden className="mt-0.5 size-4 shrink-0 text-mist" />
            <div className="min-w-0">
              <dt className="text-xs text-mist">{row.label}</dt>
              <dd className={row.value ? "break-words text-fog" : "text-mist/70"}>
                {row.value && row.to ? (
                  <Link to={row.to} className="text-electric-soft underline-offset-4 hover:underline">
                    {row.value}
                  </Link>
                ) : (
                  (row.value ?? "Não informado")
                )}
              </dd>
            </div>
          </div>
        ))}
      </dl>
      {customer.notes && <p className="mt-4 border-t border-line pt-4 text-sm whitespace-pre-line text-mist">{customer.notes}</p>}
    </section>
  );
}

function HistorySection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-8">
      <h2 id={id} className="font-display text-lg font-semibold text-white">
        {title}
      </h2>
      {children}
    </section>
  );
}

const emptyBox = "mt-3 rounded-3xl border border-dashed border-line-strong p-6 text-center text-sm text-mist";
const listBox = "mt-3 divide-y divide-line overflow-hidden rounded-3xl border border-line";
const rowBox = "flex flex-col gap-3 bg-surface/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between";

function SiteOrders({ customer }: { customer: CustomerSummary }) {
  if (customer.orders.length === 0) {
    return (
      <p className={emptyBox}>
        Nenhum pedido pelo site ainda. Quando comprar com o e-mail {customer.email ?? "cadastrado"}, o pedido aparece aqui.
      </p>
    );
  }
  return (
    <>
      <ul className={listBox}>
        {customer.orders.map((order) => (
          <li key={order.code} className={rowBox}>
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
  );
}

function ManualSales({ customer }: { customer: CustomerSummary }) {
  if (customer.manualSales.length === 0) {
    return <p className={emptyBox}>Nenhuma venda por fora lançada para este cliente. Use “Lançar venda” no topo.</p>;
  }
  return (
    <ul className={listBox}>
      {customer.manualSales.map((sale) => (
        <li key={sale.id}>
          <Link to={`/admin/financeiro/receitas/${sale.id}`} className={`${rowBox} transition-colors hover:bg-white/[0.03]`}>
            <div className="min-w-0">
              <p className="truncate font-medium text-white">{sale.description}</p>
              <p className="mt-0.5 text-xs text-mist">
                {REVENUE_CATEGORY_LABEL[sale.category]} · {formatIsoDate(sale.date)}
              </p>
            </div>
            <span className="font-semibold text-white tabular-nums">{formatBRL(sale.amount)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function CustomerProfile({ customer, partners }: { customer: CustomerSummary; partners: readonly Partner[] }) {
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
        <Stat label="Última compra" value={customer.lastPurchaseAt ? formatDate(customer.lastPurchaseAt) : "Nenhuma"} />
      </dl>

      <CustomerSheet customer={customer} partners={partners} />

      {(customer.origin === "site" || customer.orders.length > 0) && (
        <HistorySection id="pedidos-title" title="Pedidos no site">
          <SiteOrders customer={customer} />
        </HistorySection>
      )}
      {customer.record && (
        <HistorySection id="vendas-title" title="Vendas por fora">
          <ManualSales customer={customer} />
        </HistorySection>
      )}
    </>
  );
}

export default function CustomerDetailPage() {
  const { key = "" } = useParams();
  const customers = useAdminQuery(listCustomers, "admin-customers");
  // Sem a lista de parceiros a ficha ainda mostra o nome digitado, só sem o link para o parceiro.
  const partners = useAdminQuery(listPartners, "admin-partner-list");

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
  return <CustomerProfile customer={customer} partners={partners.status === "success" ? partners.data : []} />;
}
