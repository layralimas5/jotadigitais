import { ExternalLink, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { normalizeSearch } from "@/application/catalog";
import { listAllAccounts } from "@/application/admin-use-cases";
import { ACCOUNT_STATUSES, formatCount, type Account, type AccountStatus } from "@/domain/account";
import { formatBRL } from "@/domain/money";
import { PLATFORMS, PLATFORM_LABEL, type Platform } from "@/domain/platform";
import { ButtonLink } from "@/ui/components/Button";
import { AccountAvatar } from "@/ui/components/account/AccountAvatar";
import { PlatformGlyph } from "@/ui/components/PlatformGlyph";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { ACCOUNT_STATUS_LABEL, audienceLabel } from "@/ui/lib/account-presenter";
import { cn } from "@/ui/lib/cn";
import { FlashNotice, LoadingBlock, PageHeader } from "../components/AdminUi";
import { useAdminQuery } from "../hooks";

const statusTone: Record<AccountStatus, string> = {
  available: "bg-emerald-400/10 text-emerald-300 border-emerald-400/30",
  reserved: "bg-pink/10 text-pink border-pink/30",
  sold: "bg-white/[0.05] text-mist border-white/15",
};

function StatusPill({ status }: { status: AccountStatus }) {
  return (
    <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold", statusTone[status])}>
      {ACCOUNT_STATUS_LABEL[status]}
    </span>
  );
}

function AccountIdentity({ account }: { account: Account }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <AccountAvatar account={account} className="size-10 text-xs" />
      <div className="min-w-0">
        <Link
          to={`/admin/contas/${account.id}`}
          className="block truncate font-semibold text-white after:absolute after:inset-0 hover:text-electric-soft focus-visible:outline-none"
        >
          {account.displayName}
        </Link>
        <p className="flex items-center gap-1.5 truncate text-xs text-mist">
          <PlatformGlyph platform={account.platform} className="size-3.5" />
          {account.handle}
        </p>
      </div>
    </div>
  );
}

function SiteLink({ account }: { account: Account }) {
  return (
    <a
      href={`/contas/${account.slug}`}
      target="_blank"
      rel="noreferrer"
      aria-label={`Ver ${account.handle} no site`}
      className="relative z-10 grid size-9 place-items-center rounded-full text-mist hover:bg-white/[0.06] hover:text-white"
    >
      <ExternalLink aria-hidden className="size-4" />
    </a>
  );
}

function AccountsTable({ accounts }: { accounts: Account[] }) {
  return (
    <div className="hidden overflow-hidden rounded-3xl border border-line md:block">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface text-xs text-mist">
          <tr>
            <th scope="col" className="px-5 py-3 font-medium">Conta</th>
            <th scope="col" className="px-4 py-3 font-medium">Rede</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Público</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Preço</th>
            <th scope="col" className="px-4 py-3 font-medium">Status</th>
            <th scope="col" className="px-4 py-3"><span className="sr-only">Ações</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {accounts.map((account) => (
            <tr key={account.id} className="relative transition-colors hover:bg-white/[0.02]">
              <td className="px-5 py-3"><AccountIdentity account={account} /></td>
              <td className="px-4 py-3 text-fog">{PLATFORM_LABEL[account.platform]}</td>
              <td className="px-4 py-3 text-right text-fog tabular-nums">
                {formatCount(account.followers)} <span className="text-xs text-mist">{audienceLabel(account).toLowerCase()}</span>
              </td>
              <td className="px-4 py-3 text-right font-semibold text-white tabular-nums">{formatBRL(account.price)}</td>
              <td className="px-4 py-3"><StatusPill status={account.status} /></td>
              <td className="px-4 py-3 text-right"><SiteLink account={account} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AccountsCards({ accounts }: { accounts: Account[] }) {
  return (
    <ul className="space-y-2.5 md:hidden">
      {accounts.map((account) => (
        <li key={account.id} className="relative rounded-2xl border border-line bg-surface/60 p-4">
          <div className="flex items-start justify-between gap-3">
            <AccountIdentity account={account} />
            <SiteLink account={account} />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3 text-sm">
            <span className="text-fog tabular-nums">
              {formatCount(account.followers)} <span className="text-xs text-mist">{audienceLabel(account).toLowerCase()}</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="font-semibold text-white tabular-nums">{formatBRL(account.price)}</span>
              <StatusPill status={account.status} />
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function AccountsListPage() {
  const accounts = useAdminQuery(listAllAccounts, "admin-accounts");
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState<Platform | "all">("all");
  const [status, setStatus] = useState<AccountStatus | "all">("all");

  const visible = useMemo(() => {
    if (accounts.status !== "success") return [];
    const needle = normalizeSearch(query);
    return accounts.data.filter(
      (account) =>
        (platform === "all" || account.platform === platform) &&
        (status === "all" || account.status === status) &&
        (!needle || normalizeSearch(`${account.displayName} ${account.handle}`).includes(needle)),
    );
  }, [accounts, query, platform, status]);

  const total = accounts.status === "success" ? accounts.data.length : 0;
  const available = accounts.status === "success" ? accounts.data.filter((item) => item.status === "available").length : 0;

  return (
    <div className="space-y-6">
      <FlashNotice />
      <PageHeader
        title="Contas"
        description={accounts.status === "success" ? `${total} cadastradas, ${available} disponíveis na vitrine.` : "Estoque da vitrine."}
        action={
          <ButtonLink to="/admin/contas/nova" className="w-full sm:w-auto">
            <Plus aria-hidden className="size-4" /> Nova conta
          </ButtonLink>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Buscar conta</span>
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-mist" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nome ou @"
            className="h-11 w-full rounded-full border border-line-strong bg-surface pr-4 pl-11 text-sm text-white placeholder:text-mist focus:border-electric focus:outline-none"
          />
        </label>
        <div className="grid grid-cols-2 gap-3 sm:flex">
          <label>
            <span className="sr-only">Rede</span>
            <select
              value={platform}
              onChange={(event) => setPlatform(event.target.value as Platform | "all")}
              className="h-11 w-full rounded-full border border-line-strong bg-surface px-4 text-sm text-white focus:border-electric focus:outline-none"
            >
              <option value="all">Todas as redes</option>
              {PLATFORMS.map((option) => (
                <option key={option} value={option}>
                  {PLATFORM_LABEL[option]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as AccountStatus | "all")}
              className="h-11 w-full rounded-full border border-line-strong bg-surface px-4 text-sm text-white focus:border-electric focus:outline-none"
            >
              <option value="all">Todos os status</option>
              {ACCOUNT_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {ACCOUNT_STATUS_LABEL[option]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {accounts.status === "loading" && <LoadingBlock />}
      {accounts.status === "error" && <ErrorState message={accounts.error.message} onRetry={accounts.reload} />}
      {accounts.status === "success" && total === 0 && (
        <EmptyState
          title="Nenhuma conta cadastrada"
          description="Cadastre a primeira conta e ela aparece na vitrine do site na hora."
          action={<ButtonLink to="/admin/contas/nova">Cadastrar conta</ButtonLink>}
        />
      )}
      {accounts.status === "success" && total > 0 && visible.length === 0 && (
        <EmptyState title="Nenhuma conta com esses filtros" description="Mude a busca, a rede ou o status." />
      )}
      {visible.length > 0 && (
        <>
          <AccountsTable accounts={visible} />
          <AccountsCards accounts={visible} />
        </>
      )}
    </div>
  );
}
