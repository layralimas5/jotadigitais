import { MessageCircle, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listCustomers } from "@/application/admin-use-cases";
import type { CustomerSummary } from "@/domain/customer";
import { formatBRL } from "@/domain/money";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { LoadingBlock, PageHeader } from "../components/AdminUi";
import { useAdminQuery } from "../hooks";
import { formatDate } from "../lib/dates";
import { firstNameOf, whatsappChatUrl } from "../lib/whatsapp";

const customerPath = (customer: Pick<CustomerSummary, "key">) => `/admin/clientes/${encodeURIComponent(customer.key)}`;

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] ?? ""}${parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : ""}`.toUpperCase();
}

function matches(customer: CustomerSummary, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const digits = needle.replace(/\D/g, "");
  return (
    customer.name.toLowerCase().includes(needle) ||
    customer.email.toLowerCase().includes(needle) ||
    (digits.length >= 3 && (customer.whatsapp ?? "").includes(digits))
  );
}

function WhatsAppButton({ customer }: { customer: CustomerSummary }) {
  if (!customer.whatsapp) return <span className="text-xs text-mist">Sem WhatsApp</span>;
  return (
    <a
      href={whatsappChatUrl(customer.whatsapp, `Olá, ${firstNameOf(customer.name)}! Aqui é da Jota Digitais.`)}
      target="_blank"
      rel="noreferrer"
      aria-label={`Chamar ${customer.name} no WhatsApp`}
      className="relative z-10 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-400/20"
    >
      <MessageCircle aria-hidden className="size-3.5" /> WhatsApp
    </a>
  );
}

function CustomerIdentity({ customer }: { customer: CustomerSummary }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden
        className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet to-pink font-display text-xs font-semibold text-white"
      >
        {initialsOf(customer.name)}
      </span>
      <div className="min-w-0">
        <Link
          to={customerPath(customer)}
          className="block truncate font-semibold text-white after:absolute after:inset-0 hover:text-electric-soft focus-visible:outline-none"
        >
          {customer.name}
        </Link>
        <p className="truncate text-xs text-mist">{customer.email}</p>
      </div>
    </div>
  );
}

const purchasesLabel = (customer: CustomerSummary) =>
  `${customer.purchases} ${customer.purchases === 1 ? "compra" : "compras"}`;

function CustomersTable({ customers }: { customers: CustomerSummary[] }) {
  return (
    <div className="hidden overflow-hidden rounded-3xl border border-line lg:block">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface text-xs text-mist">
          <tr>
            <th scope="col" className="px-5 py-3 font-medium">Cliente</th>
            <th scope="col" className="px-4 py-3 font-medium">Contato</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Compras</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Total gasto</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Último pedido</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {customers.map((customer) => (
            <tr key={customer.key} className="relative transition-colors hover:bg-white/[0.02]">
              <td className="px-5 py-3"><CustomerIdentity customer={customer} /></td>
              <td className="px-4 py-3"><WhatsAppButton customer={customer} /></td>
              <td className="px-4 py-3 text-right text-fog tabular-nums">
                {customer.purchases}
                {customer.openOrders > 0 && <span className="ml-1.5 text-xs text-pink">+{customer.openOrders} em aberto</span>}
              </td>
              <td className="px-4 py-3 text-right font-semibold text-white tabular-nums">{formatBRL(customer.totalSpent)}</td>
              <td className="px-4 py-3 text-right text-fog">{formatDate(customer.lastOrderAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CustomersCards({ customers }: { customers: CustomerSummary[] }) {
  return (
    <ul className="grid gap-2.5 lg:hidden">
      {customers.map((customer) => (
        <li key={customer.key} className="relative rounded-2xl border border-line bg-surface/60 p-4 active:bg-surface">
          <CustomerIdentity customer={customer} />
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3 text-sm">
            <span className="text-fog">
              {purchasesLabel(customer)} · <span className="font-semibold text-white tabular-nums">{formatBRL(customer.totalSpent)}</span>
            </span>
            <WhatsAppButton customer={customer} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function CustomersPage() {
  const customers = useAdminQuery(listCustomers, "admin-customers");
  const [query, setQuery] = useState("");

  const visible = useMemo(
    () => (customers.status === "success" ? customers.data.filter((customer) => matches(customer, query)) : []),
    [customers, query],
  );

  const summary =
    customers.status === "success"
      ? `${customers.data.length} ${customers.data.length === 1 ? "cliente" : "clientes"}, ${formatBRL(
          customers.data.reduce((sum, customer) => sum + customer.totalSpent, 0),
        )} em compras pagas.`
      : "Quem já fez pedido na loja.";

  return (
    <div className="space-y-6">
      <PageHeader title="Clientes" description={summary} />

      <label className="relative block lg:max-w-md">
        <span className="sr-only">Buscar cliente</span>
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-mist" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por nome, e-mail ou WhatsApp"
          className="h-11 w-full rounded-full border border-line-strong bg-surface pr-4 pl-11 text-sm text-white placeholder:text-mist focus:border-electric focus:outline-none"
        />
      </label>

      {customers.status === "loading" && <LoadingBlock />}
      {customers.status === "error" && <ErrorState message={customers.error.message} onRetry={customers.reload} />}
      {customers.status === "success" && customers.data.length === 0 && (
        <EmptyState
          title="Nenhum cliente ainda"
          description="Quem finalizar uma compra no site aparece aqui, com o contato e o histórico de pedidos."
        />
      )}
      {customers.status === "success" && customers.data.length > 0 && visible.length === 0 && (
        <EmptyState title="Ninguém encontrado" description="Confira o nome, o e-mail ou o número digitado." />
      )}
      {visible.length > 0 && (
        <>
          <CustomersTable customers={visible} />
          <CustomersCards customers={visible} />
        </>
      )}
    </div>
  );
}
