import { KeyRound, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { findEmailAccount, listAllAccounts, listEmailAccounts } from "@/application/admin-use-cases";
import type { Account } from "@/domain/account";
import { deviceKeyOf, devicesOf, matchesEmailAccount, type EmailAccountListItem } from "@/domain/email-account";
import { ButtonLink } from "@/ui/components/Button";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { Fab, LoadingBlock, PageHeader } from "../components/AdminUi";
import { FilterChips, type FilterChipOption } from "../components/FilterChips";
import { SearchInput } from "../components/SearchInput";
import { CopyButton } from "../emails/CopyButton";
import { DeviceIcon } from "../emails/DeviceField";
import { useCopy } from "../emails/use-copy";
import { useAdminQuery, useMutation } from "../hooks";
import { useToast } from "../toast";

const emailPath = (item: EmailAccountListItem) => `/admin/emails/${item.id}`;

/** Filtro de aparelho na URL (?aparelho=iphone): o link mantém o recorte. */
const DEVICE_PARAM = "aparelho";
const ALL = "all";
const NO_DEVICE = "none";

function matchesDevice(item: EmailAccountListItem, filter: string): boolean {
  if (filter === ALL) return true;
  if (filter === NO_DEVICE) return !item.device?.trim();
  return item.device ? deviceKeyOf(item.device) === filter : false;
}

function DeviceBadge({ device }: { device: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-electric/30 bg-electric/[0.08] px-2 py-0.5 text-[0.68rem] font-semibold text-electric-soft">
      <DeviceIcon device={device} className="size-3" />
      {device}
    </span>
  );
}

function NoPasswordBadge() {
  return <span className="shrink-0 rounded-full border border-amber-300/30 bg-amber-300/[0.08] px-2 py-0.5 text-[0.68rem] font-semibold text-amber-200">Sem senha</span>;
}

function EmailRow({ item, account }: { item: EmailAccountListItem; account: Account | undefined }) {
  const copy = useCopy();
  const toast = useToast();
  const reveal = useMutation(findEmailAccount);

  const copyPassword = async () => {
    const full = await reveal.run(item.id);
    if (full?.password) await copy(full.password, "Senha copiada.");
    else toast.show(full ? "Este e-mail ainda não tem senha anotada." : "Não foi possível abrir a senha. Tente de novo.", "error");
  };

  return (
    <li className="relative flex items-center gap-3 rounded-2xl border border-line bg-surface/60 p-4 transition-colors hover:bg-surface">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2">
          <Link
            to={emailPath(item)}
            className="min-w-0 truncate font-semibold text-white after:absolute after:inset-0 hover:text-electric-soft focus-visible:outline-none"
          >
            {item.email}
          </Link>
          {item.device && <DeviceBadge device={item.device} />}
          {!item.hasPassword && <NoPasswordBadge />}
        </p>
        <p className="truncate text-xs text-mist">
          {[item.usedFor, account?.handle].filter(Boolean).join(" · ") || "Sem conta ligada"}
        </p>
      </div>
      <CopyButton label={`Copiar o e-mail ${item.email}`} onCopy={() => void copy(item.email, "E-mail copiado.")} />
      {item.hasPassword && (
        <CopyButton label={`Copiar a senha de ${item.email}`} icon={KeyRound} pending={reveal.pending} onCopy={() => void copyPassword()} />
      )}
    </li>
  );
}

export default function EmailAccountsPage() {
  const emails = useAdminQuery(listEmailAccounts, "admin-email-accounts");
  const accounts = useAdminQuery(listAllAccounts, "admin-email-accounts-stock");
  const [query, setQuery] = useState("");
  const [params, setParams] = useSearchParams();
  const data = emails.status === "success" ? emails.data : null;
  const devices = useMemo(() => devicesOf(data ?? []), [data]);
  const rawDevice = params.get(DEVICE_PARAM) ?? ALL;
  const device = rawDevice === NO_DEVICE || devices.some((name) => deviceKeyOf(name) === rawDevice) ? rawDevice : ALL;
  const visible = useMemo(
    () => (data ? data.filter((item) => matchesDevice(item, device) && matchesEmailAccount(item, query)) : []),
    [data, device, query],
  );
  const deviceOptions = useMemo((): FilterChipOption<string>[] => {
    const items = data ?? [];
    const withoutDevice = items.filter((item) => matchesDevice(item, NO_DEVICE)).length;
    return [
      { value: ALL, label: "Todos", count: items.length },
      ...devices.map((name) => ({
        value: deviceKeyOf(name),
        label: name,
        count: items.filter((item) => matchesDevice(item, deviceKeyOf(name))).length,
        icon: <DeviceIcon device={name} className="size-3.5" />,
      })),
      ...(withoutDevice > 0 ? [{ value: NO_DEVICE, label: "Sem aparelho", count: withoutDevice }] : []),
    ];
  }, [data, devices]);
  const setDevice = (next: string) => {
    const updated = new URLSearchParams(params);
    if (next === ALL) updated.delete(DEVICE_PARAM);
    else updated.set(DEVICE_PARAM, next);
    setParams(updated, { replace: true });
  };
  const accountById = useMemo(
    () => new Map((accounts.status === "success" ? accounts.data : []).map((account) => [account.id, account])),
    [accounts],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="E-mails"
        description="E-mails e senhas das contas que você está crescendo. A senha fica cifrada no banco e só abre aqui no painel."
        action={
          <ButtonLink to="/admin/emails/novo" className="max-md:hidden">
            <Plus aria-hidden className="size-4" /> Novo e-mail
          </ButtonLink>
        }
      />

      {emails.status === "loading" && <LoadingBlock />}
      {emails.status === "error" && <ErrorState message={emails.error.message} onRetry={emails.reload} />}
      {data && data.length === 0 && (
        <EmptyState
          title="Nenhum e-mail salvo ainda"
          description="Guarde aqui o e-mail, a senha e os dados de recuperação de cada conta que você está crescendo."
          action={
            <ButtonLink to="/admin/emails/novo">
              <Plus aria-hidden className="size-4" /> Salvar e-mail
            </ButtonLink>
          }
        />
      )}
      {data && data.length > 0 && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <SearchInput label="Buscar e-mail" placeholder="Buscar por e-mail, conta ou anotação" value={query} onChange={setQuery} />
            </div>
            <p className="flex shrink-0 items-center gap-1.5 text-sm text-mist">
              <KeyRound aria-hidden className="size-4" />
              {data.length} {data.length === 1 ? "e-mail salvo" : "e-mails salvos"}
            </p>
          </div>
          {devices.length > 0 && <FilterChips<string> label="Aparelho onde o e-mail está logado" value={device} options={deviceOptions} onChange={setDevice} />}
          {visible.length === 0 ? (
            <EmptyState title="Nada encontrado" description="Confira o que foi digitado na busca ou troque o aparelho." />
          ) : (
            <ul className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
              {visible.map((item) => (
                <EmailRow key={item.id} item={item} account={item.accountId ? accountById.get(item.accountId) : undefined} />
              ))}
            </ul>
          )}
        </>
      )}
      <Fab to="/admin/emails/novo" label="Novo e-mail" />
    </div>
  );
}
