import { BadgeDollarSign, ChevronDown, ExternalLink, MessageCircle, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { normalizeSearch } from "@/application/catalog";
import { deleteAccounts, listAllAccounts, saveAccount } from "@/application/admin-use-cases";
import { ACCOUNT_STATUSES, MONETIZED_PLATFORMS, formatCount, isMonetized, type Account, type AccountStatus } from "@/domain/account";
import { sortCountries, type Country } from "@/domain/country";
import { formatBRL } from "@/domain/money";
import { PLATFORM_LABEL, type Platform } from "@/domain/platform";
import { ButtonLink } from "@/ui/components/Button";
import { AccountAvatar } from "@/ui/components/account/AccountAvatar";
import { PlatformGlyph } from "@/ui/components/PlatformGlyph";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { ACCOUNT_STATUS_LABEL, audienceLabel } from "@/ui/lib/account-presenter";
import { cn } from "@/ui/lib/cn";
import { ShareAccountDialog } from "../accounts/ShareAccountDialog";
import { DeleteDialog, MobileSelectAll, RowTrashButton, SelectAllCheckbox, SelectCheckbox, SelectionBar } from "../components/BulkSelection";
import { Fab, LoadingBlock, PageHeader } from "../components/AdminUi";
import { FilterSelect } from "../components/FilterSelect";
import { useAdminQuery, useMutation } from "../hooks";
import { useBulkDelete, type Noun } from "../lib/use-bulk-delete";
import { useSelection, type Selection } from "../lib/use-selection";
import { useToast } from "../toast";

const statusTone: Record<AccountStatus, string> = {
  available: "bg-emerald-400/10 text-emerald-300 border-emerald-400/30",
  reserved: "bg-pink/10 text-pink border-pink/30",
  sold: "bg-white/[0.05] text-mist border-white/15",
};

type StatusChange = (account: Account, status: AccountStatus) => void;

const ACCOUNT_NOUN: Noun = { one: "conta", many: "contas", feminine: true };

type MonetizationFilter = "all" | "monetized" | "not_monetized";

const MONETIZATION_OPTIONS: { value: MonetizationFilter; label: string }[] = [
  { value: "all", label: "Monetização" },
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
  onDelete: (account: Account) => void;
  selection: Selection;
  busy: boolean;
}

const selectedRow = "bg-electric/[0.06] hover:bg-electric/[0.08]";

function AccountsTable({ accounts, onStatusChange, onShare, onDelete, selection, busy }: ListProps) {
  return (
    <div className="hidden overflow-hidden rounded-3xl border border-line lg:block">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface text-xs text-mist">
          <tr>
            <th scope="col" className="w-12 py-1.5 pl-3">
              <SelectAllCheckbox selection={selection} total={accounts.length} />
            </th>
            <th scope="col" className="py-3 pr-5 pl-1 font-medium">Conta</th>
            <th scope="col" className="px-4 py-3 font-medium">Rede</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Público</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Preço</th>
            <th scope="col" className="px-4 py-3 font-medium">Status</th>
            <th scope="col" className="px-4 py-3"><span className="sr-only">Ações</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {accounts.map((account) => (
            <tr
              key={account.id}
              className={cn("relative transition-colors hover:bg-white/[0.02]", selection.selected.has(account.id) && selectedRow)}
            >
              <td className="py-3 pl-3">
                <SelectCheckbox
                  checked={selection.selected.has(account.id)}
                  label={`Selecionar ${account.handle}`}
                  onChange={() => selection.toggle(account.id)}
                />
              </td>
              <td className="py-3 pr-5 pl-1"><AccountIdentity account={account} /></td>
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
                  <RowTrashButton label={`Apagar ${account.handle}`} onClick={() => onDelete(account)} />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AccountsCards({ accounts, onStatusChange, onShare, selection, busy }: ListProps) {
  return (
    <ul className="grid grid-cols-1 gap-2.5 lg:hidden">
      {accounts.map((account) => (
        <li
          key={account.id}
          className={cn(
            "relative rounded-2xl border border-line bg-surface/60 p-4 transition-transform active:scale-[0.985] active:bg-surface",
            selection.selected.has(account.id) && "border-electric/50 bg-electric/[0.06]",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-1">
              <SelectCheckbox
                checked={selection.selected.has(account.id)}
                label={`Selecionar ${account.handle}`}
                onChange={() => selection.toggle(account.id)}
                className="-ml-2"
              />
              <AccountIdentity account={account} />
            </div>
            <span className="flex shrink-0">
              <ShareButton account={account} onShare={onShare} />
              <SiteLink account={account} />
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-line pt-3 text-sm">
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
  const [country, setCountry] = useState<string>("all");
  const [sharing, setSharing] = useState<Account | null>(null);

  /** Só os países que têm conta cadastrada, Brasil primeiro. */
  const countryOptions = useMemo<Country[]>(() => {
    if (accounts.status !== "success") return [];
    const byCode = new Map(accounts.data.map((account) => [account.country, account.countryName]));
    return sortCountries([...byCode].map(([code, name]) => ({ code, name })));
  }, [accounts]);

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
        (country === "all" || account.country === country) &&
        matchesMonetization(account, monetization) &&
        (!needle || normalizeSearch(`${account.displayName} ${account.handle}`).includes(needle)),
    );
  }, [accounts, query, platform, status, country, monetization]);

  const visibleIds = useMemo(() => visible.map((account) => account.id), [visible]);
  const selection = useSelection(visibleIds);
  const trash = useBulkDelete<Account>({
    noun: ACCOUNT_NOUN,
    remove: (deps, items) => deleteAccounts(deps, items.map((account) => account.id)),
    onDone: () => {
      selection.clear();
      accounts.reload();
    },
  });
  const askDeleteSelected = () => trash.ask(visible.filter((account) => selection.selected.has(account.id)));

  const listProps: ListProps = {
    accounts: visible,
    onStatusChange,
    onShare: setSharing,
    onDelete: (account) => trash.ask([account]),
    selection,
    busy: changeStatus.pending,
  };

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

      <div className="flex flex-col gap-3 2xl:flex-row">
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:flex 2xl:shrink-0">
          <FilterSelect
            label="Rede"
            className="lg:min-w-0 lg:flex-1 2xl:w-44 2xl:flex-none"
            value={platform}
            options={[{ value: "all", label: "Todas as redes" }, ...platformOptions.map((option) => ({ value: option, label: PLATFORM_LABEL[option] }))]}
            onChange={setPlatform}
          />
          <FilterSelect
            label="Status"
            className="lg:min-w-0 lg:flex-1 2xl:w-44 2xl:flex-none"
            value={status}
            options={[{ value: "all", label: "Todos os status" }, ...ACCOUNT_STATUSES.map((option) => ({ value: option, label: ACCOUNT_STATUS_LABEL[option] }))]}
            onChange={setStatus}
          />
          <FilterSelect
            label="País"
            className="lg:min-w-0 lg:flex-1 2xl:w-44 2xl:flex-none"
            value={country}
            options={[{ value: "all", label: "Todos os países" }, ...countryOptions.map((option) => ({ value: option.code, label: option.name }))]}
            onChange={setCountry}
          />
          <FilterSelect
            label="Monetização"
            className="lg:min-w-0 lg:flex-1 2xl:w-44 2xl:flex-none"
            value={monetization}
            options={MONETIZATION_OPTIONS}
            onChange={setMonetization}
          />
          <ButtonLink to="/admin/contas/nova" className="h-11 w-40 shrink-0 shadow-none hover:shadow-none max-lg:hidden">
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
        <EmptyState title="Nenhuma conta com esses filtros" description="Mude a busca, a rede, o status, o país ou a monetização." />
      )}
      {visible.length > 0 && (
        <>
          <MobileSelectAll selection={selection} total={visible.length} />
          <AccountsTable {...listProps} />
          <AccountsCards {...listProps} />
        </>
      )}
      <ShareAccountDialog account={sharing} onClose={() => setSharing(null)} />
      <SelectionBar selection={selection} noun={ACCOUNT_NOUN} onDelete={askDeleteSelected} />
      <DeleteDialog
        open={trash.open}
        count={trash.pending.length}
        noun={ACCOUNT_NOUN}
        singleName={trash.pending.length === 1 ? (trash.pending[0]?.handle ?? null) : null}
        busy={trash.busy}
        onConfirm={() => void trash.confirm()}
        onClose={trash.cancel}
        consequence="Some da vitrine e do painel na hora. Pedidos e despesas ligados continuam no Financeiro, sem a conta. Não dá para desfazer."
      />
      {selection.selectedIds.length === 0 && <Fab to="/admin/contas/nova" label="Nova conta" />}
    </div>
  );
}
