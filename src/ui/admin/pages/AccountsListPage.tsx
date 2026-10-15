import { BadgeDollarSign, ChevronDown, ExternalLink, MessageCircle, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { normalizeSearch } from "@/application/catalog";
import { listAllAccounts, saveAccount } from "@/application/admin-use-cases";
import { ACCOUNT_STATUSES, MONETIZED_PLATFORMS, formatCount, isMonetized, type Account, type AccountStatus } from "@/domain/account";
import { formatBRL } from "@/domain/money";
import { PLATFORM_LABEL, type Platform } from "@/domain/platform";
import { ButtonLink } from "@/ui/components/Button";
import { AccountAvatar } from "@/ui/components/account/AccountAvatar";
import { PlatformGlyph } from "@/ui/components/PlatformGlyph";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { ACCOUNT_STATUS_LABEL, audienceLabel } from "@/ui/lib/account-presenter";
import { cn } from "@/ui/lib/cn";
import { ShareAccountDialog } from "../accounts/ShareAccountDialog";
import { Fab, LoadingBlock, PageHeader } from "../components/AdminUi";
import { useAdminQuery, useMutation } from "../hooks";
import { useToast } from "../toast";

const statusTone: Record<AccountStatus, string> = {
  available: "bg-emerald-400/10 text-emerald-300 border-emerald-400/30",
  reserved: "bg-pink/10 text-pink border-pink/30",
  sold: "bg-white/[0.05] text-mist border-white/15",
};

type StatusChange = (account: Account, status: AccountStatus) => void;

type MonetizationFilter = "all" | "monetized" | "not_monetized";

const MONETIZATION_OPTIONS: { value: MonetizationFilter; label: string }[] = [
  { value: "all", label: "Monetização: todas" },
  { value: "monetized", label: "Monetizadas" },
  { value: "not_monetized", label: "Não monetizadas" },
];

const matchesMonetization = (account: Account, filter: MonetizationFilter) =>
  filter === "all" || (filter === "monetized") === isMonetized(account);

function MonetizedBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-px text-[0.65rem] font-semibold text-emerald-300">
      <BadgeDollarSign aria-hidden className="size-3" /> Monetizada
    </span>
  );
}

/** Troca rápida de status sem abrir o cadastro. No celular abre o seletor nativo do sistema. */
function StatusSelect({ account, onChange, disabled }: { account: Account; onChange: StatusChange; disabled: boolean }) {
  return (
    <label className={cn("relative z-10 inline-flex items-center rounded-full border text-xs font-semibold", statusTone[account.status])}>
      <span className="sr-only">Status de {account.handle}</span>
      <select
        value={account.status}
        disabled={disabled}
        onChange={(event) => onChange(account, event.target.value as AccountStatus)}
        className="cursor-pointer appearance-none bg-transparent py-1 pr-7 pl-3 focus:outline-none disabled:cursor-wait"
      >
        {ACCOUNT_STATUSES.map((option) => (
          <option key={option} value={option} className="bg-surface text-white">
            {ACCOUNT_STATUS_LABEL[option]}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-2 size-3.5" />
    </label>
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
          <span className="truncate">{account.handle}</span>
          {isMonetized(account) && <MonetizedBadge />}
        </p>
      </div>
    </div>
  );
}

function ShareButton({ account, onShare }: { account: Account; onShare: (account: Account) => void }) {
  return (
    <button
      type="button"
      onClick={() => onShare(account)}
      aria-label={`Enviar ${account.handle} pelo WhatsApp`}
      title="Enviar pelo WhatsApp"
      className="relative z-10 grid size-9 place-items-center rounded-full text-[#25d366] hover:bg-[#25d366]/10"
    >
      <MessageCircle aria-hidden className="size-4" />
    </button>
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

interface ListProps {
  accounts: Account[];
  onStatusChange: StatusChange;
  onShare: (account: Account) => void;
  busy: boolean;
}

function AccountsTable({ accounts, onStatusChange, onShare, busy }: ListProps) {
  return (
    <div className="hidden overflow-hidden rounded-3xl border border-line lg:block">
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
              <td className="px-4 py-3"><StatusSelect account={account} onChange={onStatusChange} disabled={busy} /></td>
              <td className="px-4 py-3">
                <span className="flex justify-end">
                  <ShareButton account={account} onShare={onShare} />
                  <SiteLink account={account} />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AccountsCards({ accounts, onStatusChange, onShare, busy }: ListProps) {
  return (
    <ul className="grid gap-2.5 lg:hidden">
      {accounts.map((account) => (
        <li
          key={account.id}
          className="relative rounded-2xl border border-line bg-surface/60 p-4 transition-transform active:scale-[0.985] active:bg-surface"
        >
          <div className="flex items-start justify-between gap-3">
            <AccountIdentity account={account} />
            <span className="flex shrink-0">
              <ShareButton account={account} onShare={onShare} />
              <SiteLink account={account} />
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3 text-sm">
            <span className="text-fog tabular-nums">
              {formatCount(account.followers)} <span className="text-xs text-mist">{audienceLabel(account).toLowerCase()}</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="font-semibold text-white tabular-nums">{formatBRL(account.price)}</span>
              <StatusSelect account={account} onChange={onStatusChange} disabled={busy} />
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function AccountsListPage() {
  const accounts = useAdminQuery(listAllAccounts, "admin-accounts");
  const toast = useToast();
  const changeStatus = useMutation((deps, account: Account, status: AccountStatus) =>
    saveAccount(deps, account.id, { ...account, status }),
  );

  const onStatusChange: StatusChange = async (account, status) => {
    const saved = await changeStatus.run(account, status);
    if (!saved) {
      toast.show("Não foi possível mudar o status.", "error");
      return;
    }
    toast.show(`${saved.handle}: ${ACCOUNT_STATUS_LABEL[status].toLowerCase()}`);
    accounts.reload();
  };
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState<Platform | "all">("all");
  const [status, setStatus] = useState<AccountStatus | "all">("all");
  const [monetization, setMonetization] = useState<MonetizationFilter>("all");
  const [sharing, setSharing] = useState<Account | null>(null);

  /** Facebook só aparece no filtro se ainda houver conta antiga dessa rede. */
  const platformOptions = useMemo<Platform[]>(() => {
    const hasFacebook = accounts.status === "success" && accounts.data.some((account) => account.platform === "facebook");
    return hasFacebook ? [...MONETIZED_PLATFORMS, "facebook"] : [...MONETIZED_PLATFORMS];
  }, [accounts]);

  const visible = useMemo(() => {
    if (accounts.status !== "success") return [];
    const needle = normalizeSearch(query);
    return accounts.data.filter(
      (account) =>
        (platform === "all" || account.platform === platform) &&
        (status === "all" || account.status === status) &&
        matchesMonetization(account, monetization) &&
        (!needle || normalizeSearch(`${account.displayName} ${account.handle}`).includes(needle)),
    );
  }, [accounts, query, platform, status, monetization]);

  const total = accounts.status === "success" ? accounts.data.length : 0;
  const available = accounts.status === "success" ? accounts.data.filter((item) => item.status === "available").length : 0;
  const monetized = accounts.status === "success" ? accounts.data.filter(isMonetized).length : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contas"
        description={
          accounts.status === "success"
            ? `Contas de TikTok, Instagram e YouTube: ${total} cadastradas, ${available} disponíveis, ${monetized} monetizadas.`
            : "Contas de TikTok, Instagram e YouTube."
        }
        action={
          <ButtonLink to="/admin/contas/nova" className="max-md:hidden lg:hidden">
            <Plus aria-hidden className="size-4" /> Nova conta
          </ButtonLink>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row">
        <label className="relative min-w-0 flex-1">
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:flex lg:shrink-0">
          <label className="lg:w-40">
            <span className="sr-only">Rede</span>
            <select
              value={platform}
              onChange={(event) => setPlatform(event.target.value as Platform | "all")}
              className="h-11 w-full rounded-full border border-line-strong bg-surface px-4 text-sm text-white focus:border-electric focus:outline-none"
            >
              <option value="all">Todas as redes</option>
              {platformOptions.map((option) => (
                <option key={option} value={option}>
                  {PLATFORM_LABEL[option]}
                </option>
              ))}
            </select>
          </label>
          <label className="lg:w-40">
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
          <label className="col-span-2 sm:col-span-1 lg:w-48">
            <span className="sr-only">Monetização</span>
            <select
              value={monetization}
              onChange={(event) => setMonetization(event.target.value as MonetizationFilter)}
              className="h-11 w-full rounded-full border border-line-strong bg-surface px-4 text-sm text-white focus:border-electric focus:outline-none"
            >
              {MONETIZATION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <ButtonLink to="/admin/contas/nova" className="h-11 w-40 shadow-none hover:shadow-none max-lg:hidden">
            <Plus aria-hidden className="size-4" /> Nova conta
          </ButtonLink>
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
        <EmptyState title="Nenhuma conta com esses filtros" description="Mude a busca, a rede, o status ou a monetização." />
      )}
      {visible.length > 0 && (
        <>
          <AccountsTable accounts={visible} onStatusChange={onStatusChange} onShare={setSharing} busy={changeStatus.pending} />
          <AccountsCards accounts={visible} onStatusChange={onStatusChange} onShare={setSharing} busy={changeStatus.pending} />
        </>
      )}
      <ShareAccountDialog account={sharing} onClose={() => setSharing(null)} />
      <Fab to="/admin/contas/nova" label="Nova conta" />
    </div>
  );
}
