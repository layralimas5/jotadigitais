import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bell, BellRing, CheckCheck, ShieldAlert, ShieldCheck, ShoppingBag, Sparkles, X, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { AppNotification, NotificationKind } from "@/domain/notification";
import { cn } from "@/ui/lib/cn";
import { formatRelative } from "../lib/dates";
import { useCloseOnOutsideClick } from "../lib/use-close-on-outside";
import { useToast } from "../toast";
import { useNotifications } from "./useNotifications";

const KIND_VIEW: Record<NotificationKind, { icon: LucideIcon; className: string; label: string }> = {
  order: { icon: ShoppingBag, className: "bg-electric/12 text-electric-soft ring-electric/25", label: "Pedido" },
  news: { icon: Sparkles, className: "bg-pink/12 text-pink ring-pink/25", label: "Novidade" },
  privacy: { icon: ShieldCheck, className: "bg-emerald-400/12 text-emerald-300 ring-emerald-400/25", label: "Privacidade" },
  security: { icon: ShieldAlert, className: "bg-alert/12 text-alert ring-alert/25", label: "Segurança" },
  reminder: { icon: BellRing, className: "bg-amber-400/12 text-amber-300 ring-amber-400/25", label: "Lembrete" },
};

const MAX_BADGE = 9;

function NotificationItem({ item, onOpen, onDismiss }: { item: AppNotification; onOpen: () => void; onDismiss: () => void }) {
  const reduceMotion = useReducedMotion();
  const view = KIND_VIEW[item.kind];
  const Icon = view.icon;
  const content = (
    <>
      <span aria-hidden className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ring-1 ring-inset", view.className)}>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm leading-snug font-medium text-white">{item.title}</span>
        {item.body && <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-mist">{item.body}</span>}
        <span className="mt-1 block text-[0.68rem] text-mist/80">
          {view.label} · {formatRelative(item.createdAt)}
        </span>
      </span>
    </>
  );
  return (
    <motion.li
      layout={!reduceMotion}
      exit={reduceMotion ? undefined : { opacity: 0, x: 24, transition: { duration: 0.15 } }}
      className="group relative flex items-start gap-1 rounded-xl transition-colors hover:bg-white/[0.04]"
    >
      {item.link ? (
        <Link to={item.link} onClick={onOpen} className="flex min-w-0 flex-1 gap-3 rounded-xl p-2.5 focus-visible:outline-2 focus-visible:outline-electric">
          {content}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 gap-3 p-2.5">{content}</div>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label={`Apagar notificação: ${item.title}`}
        title="Apagar"
        className="mt-2 mr-1.5 grid size-7 shrink-0 place-items-center rounded-full text-mist transition-colors hover:bg-white/[0.08] hover:text-white"
      >
        <X aria-hidden className="size-3.5" />
      </button>
    </motion.li>
  );
}

/** Sininho do topo: pedidos novos, novidades e lembretes. Cada aviso tem um X para apagar. */
export function NotificationBell() {
  const toast = useToast();
  const showError = useCallback((message: string) => toast.show(message, "error"), [toast]);
  const { state, refresh, dismiss } = useNotifications(showError);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const titleId = useId();
  const reduceMotion = useReducedMotion();

  // Não fecha na troca de rota: a tela nova pode demorar a carregar e fecharia um painel já reaberto.
  // Clicar num aviso fecha o painel; clicar fora também.
  const close = useCallback(() => setOpen(false), []);
  useCloseOnOutsideClick(open, close, rootRef);

  useEffect(() => {
    if (!open) return;
    void refresh();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      close();
      triggerRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, refresh, close]);

  const items = state.status === "ready" ? state.items : [];
  const count = items.length;
  const badge = count > MAX_BADGE ? `${MAX_BADGE}+` : String(count);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={count ? `Notificações: ${count} ${count === 1 ? "nova" : "novas"}` : "Notificações"}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "relative grid size-10 place-items-center rounded-full text-mist transition-colors hover:bg-white/[0.06] hover:text-white",
          open && "bg-white/[0.06] text-white",
        )}
      >
        <Bell aria-hidden className="size-[1.15rem]" />
        {count > 0 && (
          <span
            aria-hidden
            className="absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-pink px-1 text-[0.6rem] leading-none font-bold text-ink ring-2 ring-black"
          >
            {badge}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.section
            id={panelId}
            role="dialog"
            aria-labelledby={titleId}
            initial={reduceMotion ? false : { opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-x-3 top-16 z-50 origin-top rounded-2xl border border-line-strong bg-surface shadow-2xl shadow-black/60 sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-[24rem] sm:origin-top-right"
          >
            <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
              <h2 id={titleId} className="font-display text-sm font-semibold text-white">
                Notificações
              </h2>
              {count > 0 && (
                <button
                  type="button"
                  onClick={() => void dismiss(items.map((item) => item.key))}
                  className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs text-electric-soft hover:bg-white/[0.06]"
                >
                  <CheckCheck aria-hidden className="size-3.5" /> Limpar todas
                </button>
              )}
            </header>
            <div className="max-h-[min(28rem,calc(100dvh-8rem))] overflow-y-auto p-1.5">
              {state.status === "loading" && <p className="px-3 py-8 text-center text-sm text-mist">Carregando…</p>}
              {state.status === "error" && (
                <p role="alert" className="px-3 py-8 text-center text-sm text-mist">
                  Não foi possível carregar as notificações.{" "}
                  <button type="button" onClick={() => void refresh()} className="text-electric-soft underline-offset-4 hover:underline">
                    Tentar de novo
                  </button>
                </p>
              )}
              {state.status === "ready" && count === 0 && (
                <div className="px-3 py-10 text-center">
                  <CheckCheck aria-hidden className="mx-auto size-6 text-emerald-300" />
                  <p className="mt-2 text-sm font-medium text-white">Tudo limpo por aqui</p>
                  <p className="mt-0.5 text-xs text-mist">Pedidos novos, lembretes e novidades aparecem aqui.</p>
                </div>
              )}
              {count > 0 && (
                <ul aria-label="Lista de notificações" className="space-y-0.5">
                  <AnimatePresence initial={false}>
                    {items.map((item) => (
                      <NotificationItem key={item.key} item={item} onOpen={close} onDismiss={() => void dismiss([item.key])} />
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
