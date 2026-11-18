import { Download, ExternalLink, ImageDown, QrCode, Search } from "lucide-react";
import qrcode from "qrcode-generator";
import { useMemo, useState } from "react";
import { container } from "@/app/container";
import { shareableAccounts, type ShareableAccount } from "@/application/affiliate-use-cases";
import { listAccounts } from "@/application/use-cases";
import { formatCount, type Account } from "@/domain/account";
import { affiliateLink, type AffiliateMe } from "@/domain/affiliate";
import { formatBRL } from "@/domain/money";
import { AUDIENCE_LABEL, PLATFORM_LABEL, PLATFORMS, type Platform } from "@/domain/platform";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { useAsync } from "@/ui/hooks/useAsync";
import { useDocumentMeta } from "@/ui/hooks/useDocumentMeta";
import { cn } from "@/ui/lib/cn";
import { AffiliateSpinner } from "../AffiliateLayout";
import { CopyButton, LinkBox, PanelSection } from "../components/AffiliateUi";
import { affiliatePortal, useAffiliateMe } from "../session";

type PlatformFilter = Platform | "all";

async function loadShareable(me: AffiliateMe) {
  const [accounts, commissions, clicks, sales] = await Promise.all([
    listAccounts(container.store, { onlyAvailable: true }),
    affiliatePortal.accountCommissions(),
    affiliatePortal.listClicks(),
    affiliatePortal.listCommissions(),
  ]);
  return { me, items: shareableAccounts(accounts, commissions, clicks, sales) };
}

/** QR Code do link, como imagem (o mesmo gerador do Pix na página do pedido). */
function qrDataUrl(link: string): string {
  const qr = qrcode(0, "M");
  qr.addData(link);
  qr.make();
  return qr.createDataURL(8, 2);
}

/** Texto pronto para colar no story, no grupo ou no direct. */
function pitchOf(account: Account, link: string, couponCode: string | null): string {
  const audience = `${formatCount(account.followers)} ${AUDIENCE_LABEL[account.platform].toLowerCase()}`;
  const coupon = couponCode ? `\nUse o cupom ${couponCode} e ganhe desconto.` : "";
  return `Conta de ${PLATFORM_LABEL[account.platform]} pronta: ${account.handle}, com ${audience}, por ${formatBRL(account.price)}.${coupon}\nVeja os detalhes e garanta a sua: ${link}`;
}

function QrPanel({ link, handle }: { link: string; handle: string }) {
  const src = useMemo(() => qrDataUrl(link), [link]);
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-white p-4 sm:flex-row">
      <img src={src} alt={`QR Code do link de ${handle}`} className="size-36 shrink-0" />
      <div className="text-center sm:text-left">
        <p className="text-sm text-ink">Quem apontar a câmera cai na página da conta pelo seu link.</p>
        <a
          href={src}
          download={`qrcode-${handle.replace(/^@/, "")}.png`}
          className="mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-white hover:bg-ink/85"
        >
          <Download aria-hidden className="size-4" /> Baixar QR Code
        </a>
      </div>
    </div>
  );
}

function AccountShareCard({ item, me }: { item: ShareableAccount<Account>; me: AffiliateMe }) {
  const { account } = item;
  const [open, setOpen] = useState<"qr" | "material" | null>(null);
  const link = affiliateLink(window.location.origin, me.code, account.slug);
  const toggle = (panel: "qr" | "material") => setOpen((current) => (current === panel ? null : panel));

  return (
    <li className="min-w-0 rounded-3xl border border-line bg-surface/60 p-4 sm:p-5">
      <div className="flex items-center gap-3">
        {account.avatarUrl ? (
          <img src={account.avatarUrl} alt="" loading="lazy" className="size-12 shrink-0 rounded-full object-cover" />
        ) : (
          <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-full bg-white/[0.06] font-semibold text-white">
            {account.handle.replace(/^@/, "").slice(0, 2).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-white">{account.handle}</p>
          <p className="truncate text-xs text-mist">
            {PLATFORM_LABEL[account.platform]} · {formatCount(account.followers)} {AUDIENCE_LABEL[account.platform].toLowerCase()} · {formatBRL(account.price)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-lg font-bold text-emerald-300 tabular-nums">{formatBRL(item.commission)}</p>
          <p className="text-xs text-mist">por venda</p>
        </div>
      </div>

      <div className="mt-4">
        <LinkBox link={link} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <button
          type="button"
          aria-expanded={open === "qr"}
          onClick={() => toggle("qr")}
          className={cn("inline-flex h-9 items-center gap-1.5 rounded-full border px-3 transition-colors", open === "qr" ? "border-electric text-white" : "border-line-strong text-fog hover:text-white")}
        >
          <QrCode aria-hidden className="size-4" /> QR Code
        </button>
        <button
          type="button"
          aria-expanded={open === "material"}
          onClick={() => toggle("material")}
          className={cn("inline-flex h-9 items-center gap-1.5 rounded-full border px-3 transition-colors", open === "material" ? "border-electric text-white" : "border-line-strong text-fog hover:text-white")}
        >
          <ImageDown aria-hidden className="size-4" /> Material
        </button>
        <a href={link} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-fog hover:text-white">
          <ExternalLink aria-hidden className="size-4" /> Ver página
        </a>
        <span className="ml-auto text-xs text-mist tabular-nums">
          {item.clicks} {item.clicks === 1 ? "clique" : "cliques"} · {item.sales} {item.sales === 1 ? "venda" : "vendas"}
        </span>
      </div>

      {open === "qr" && (
        <div className="mt-4">
          <QrPanel link={link} handle={account.handle} />
        </div>
      )}
      {open === "material" && (
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl border border-line bg-ink/60 p-4">
            <p className="text-sm whitespace-pre-line text-fog [overflow-wrap:anywhere]">{pitchOf(account, link, me.coupon?.code ?? null)}</p>
            <CopyButton text={pitchOf(account, link, me.coupon?.code ?? null)} label="Copiar texto" className="mt-3" />
          </div>
          {account.images.length > 0 ? (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {account.images.map((image, index) => (
                <li key={image}>
                  <a href={image} target="_blank" rel="noreferrer" download className="group block overflow-hidden rounded-xl border border-line">
                    <img src={image} alt={`Print ${index + 1} de ${account.handle}`} loading="lazy" className="aspect-[9/16] w-full object-cover transition-transform group-hover:scale-105" />
                    <span className="sr-only">Abrir para baixar</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-mist">Esta conta ainda não tem prints. Use a página da conta na divulgação.</p>
          )}
          {account.images.length > 0 && <p className="text-xs text-mist">Toque no print para abrir e salvar no celular.</p>}
        </div>
      )}
    </li>
  );
}

export default function AffiliateSharePage() {
  useDocumentMeta("Divulgar contas");
  const me = useAffiliateMe();
  const data = useAsync(() => loadShareable(me), `affiliate-share:${me.id}:${me.status}`);
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState<PlatformFilter>("all");

  if (me.status !== "approved") {
    return <EmptyState title="Vitrine fechada por enquanto" description="Assim que o seu cadastro for aprovado, as contas e os seus links aparecem aqui." />;
  }
  if (data.status === "loading") return <AffiliateSpinner />;
  if (data.status === "error") return <ErrorState message={data.error.message} onRetry={data.retry} />;

  const needle = query.trim().toLowerCase();
  const visible = data.data.items.filter(
    ({ account }) => (platform === "all" || account.platform === platform) && (!needle || account.handle.toLowerCase().includes(needle) || account.displayName.toLowerCase().includes(needle)),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-white sm:text-3xl">Divulgar</h1>
        <p className="mt-1 text-sm text-fog">Cada conta tem o seu link. Copie, mande o QR Code ou use o texto pronto.</p>
      </div>

      <PanelSection title="Link geral da loja">
        <LinkBox link={affiliateLink(window.location.origin, me.code)} />
      </PanelSection>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Buscar conta</span>
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-mist" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar pelo @ ou nome"
            className="h-11 w-full rounded-full border border-line-strong bg-ink pr-4 pl-11 text-sm text-white placeholder:text-mist/70 focus:border-electric focus:outline-none"
          />
        </label>
        <div role="group" aria-label="Rede" className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
          {(["all", ...PLATFORMS] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={platform === value}
              onClick={() => setPlatform(value)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-sm transition-colors",
                platform === value ? "border-electric bg-electric/15 text-white" : "border-line-strong text-mist hover:text-white",
              )}
            >
              {value === "all" ? "Todas" : PLATFORM_LABEL[value]}
            </button>
          ))}
        </div>
      </div>

      {data.data.items.length === 0 ? (
        <EmptyState title="Nenhuma conta liberada agora" description="Quando a loja anunciar contas no programa, elas aparecem aqui com a sua comissão." />
      ) : visible.length === 0 ? (
        <EmptyState title="Nada encontrado" description="Troque a rede ou a busca." />
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {visible.map((item) => (
            <AccountShareCard key={item.account.id} item={item} me={data.data.me} />
          ))}
        </ul>
      )}
    </div>
  );
}
