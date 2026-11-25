import { Bell, CheckCircle2, Gift, Megaphone, PackagePlus, Wallet, XCircle, type LucideIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { container } from "@/app/container";
import { loadAffiliateNotices } from "@/application/affiliate-use-cases";
import type { AffiliateNoticeKind } from "@/domain/affiliate-rewards";
import { useAsync } from "@/ui/hooks/useAsync";
import { cn } from "@/ui/lib/cn";
import { useAffiliateMe, useAffiliatePortal } from "../session";

const NOTICE_ICON: Record<AffiliateNoticeKind, { icon: LucideIcon; className: string }> = {
  sale: { icon: CheckCircle2, className: "text-electric" },
  released: { icon: Wallet, className: "text-electric" },
  payout: { icon: Wallet, className: "text-white" },
  canceled: { icon: XCircle, className: "text-mist" },
  gift: { icon: Gift, className: "text-electric" },
  announcement: { icon: Megaphone, className: "text-fog" },
  catalog: { icon: PackagePlus, className: "text-electric" },
};

const relative = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
const DAY_MS = 86_400_000;

function whenOf(at: string, now: number): string {
  const diff = Date.parse(at) - now;
  if (Math.abs(diff) < 3_600_000) return "Agora";
  if (Math.abs(diff) < DAY_MS) return relative.format(Math.round(diff / 3_600_000), "hour");
  return relative.format(Math.round(diff / DAY_MS), "day");
}

/** Central de avisos do afiliado: vendas, comissões liberadas, pagamentos, brindes, recados e contas novas. */
export function NoticesBell() {
  const me = useAffiliateMe();
  const portal = useAffiliatePortal();
  const notices = useAsync(() => loadAffiliateNotices(portal, container.store.accounts, me), `affiliate-notices:${me.id}`);
  const [open, setOpen] = useState(false);
  const [seenNow, setSeenNow] = useState(false);
  const panelId = useId();
  const wrapper = useRef<HTMLDivElement>(null);

  const items = notices.status === "success" ? notices.data : [];
  const unread = seenNow ? 0 : items.filter((notice) => notice.unread).length;

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      portal.markNoticesSeen().then(
        () => setSeenNow(true),
        (error: unknown) => console.warn("Não deu para marcar os avisos como vistos", error),
      );
    }
  };

  const now = Date.now();
  return (
    <div ref={wrapper} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={unread > 0 ? `Avisos, ${unread} novos` : "Avisos"}
        className="relative grid size-10 place-items-center rounded-full text-mist transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-2 focus-visible:outline-electric"
      >
        <Bell aria-hidden className="size-5" />
        {unread > 0 && (
          <span aria-hidden className="absolute top-1.5 right-1.5 grid min-w-4 place-items-center rounded-full bg-electric px-1 text-[0.6rem] font-bold text-white tabular-nums">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          id={panelId}
          role="region"
          aria-label="Central de avisos"
          className="absolute top-12 right-0 z-40 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl shadow-black/50"
        >
          <p className="flex items-center gap-2 border-b border-line px-4 py-3 text-sm font-semibold text-white">
            <Bell aria-hidden className="size-4" /> Central de avisos
          </p>
          {notices.status === "loading" ? (
            <p className="px-4 py-6 text-center text-sm text-mist">Carregando...</p>
          ) : notices.status === "error" ? (
            <p className="px-4 py-6 text-center text-sm text-mist">Não deu para carregar os avisos agora.</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-mist">Nada novo por aqui. Quando sua indicação vender, você vê aqui.</p>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
              {items.map((notice) => {
                const { icon: Icon, className } = NOTICE_ICON[notice.kind];
                return (
                  <li key={notice.id} className={cn("flex gap-3 px-4 py-3", notice.unread && !seenNow && "bg-electric/[0.05]")}>
                    <Icon aria-hidden className={cn("mt-0.5 size-5 shrink-0", className)} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold text-white">{notice.title}</span>
                        <span className="shrink-0 text-xs text-mist">{whenOf(notice.at, now)}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-fog">{notice.body}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
