import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useCloseOnOutsideClick } from "@/ui/admin/lib/use-close-on-outside";
import { cn } from "@/ui/lib/cn";

const itemClass =
  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-fog transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:bg-white/[0.06] focus-visible:text-white focus-visible:outline-none";

const dangerClass = "text-[#ff9a9a] hover:text-[#ffb3b3] focus-visible:text-[#ffb3b3]";

export type PanelMenuItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  danger?: boolean;
} & ({ to: string; external?: boolean } | { onSelect: () => void });

interface PanelUserMenuProps {
  name: string | null;
  email: string;
  /** Foto no lugar da inicial. */
  avatar?: ReactNode;
  /** Selo embaixo do nome (papel no painel, situação do afiliado). */
  badge?: ReactNode;
  items: readonly PanelMenuItem[];
}

const initialOf = (text: string) => text.trim().charAt(0).toUpperCase() || "J";

/** Ícone da pessoa no canto superior direito, com o menu da conta (teclado: setas, Home, End, Esc). */
export function PanelUserMenu({ name, email, avatar, badge, items }: PanelUserMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const reduceMotion = useReducedMotion();

  const close = useCallback(() => setOpen(false), []);
  useCloseOnOutsideClick(open, close, rootRef);

  useEffect(() => {
    if (open) menuRef.current?.querySelector<HTMLElement>("[role='menuitem']")?.focus();
  }, [open]);

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const entries = Array.from(menuRef.current?.querySelectorAll<HTMLElement>("[role='menuitem']") ?? []);
    const current = entries.indexOf(document.activeElement as HTMLElement);
    const focusAt = (index: number) => entries[(index + entries.length) % entries.length]?.focus();
    switch (event.key) {
      case "ArrowDown":
        focusAt(current + 1);
        break;
      case "ArrowUp":
        focusAt(current - 1);
        break;
      case "Home":
        focusAt(0);
        break;
      case "End":
        focusAt(entries.length - 1);
        break;
      case "Escape":
        close();
        triggerRef.current?.focus();
        break;
      case "Tab":
        close();
        return;
      default:
        return;
    }
    event.preventDefault();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label="Menu do usuário"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1.5 rounded-full p-1 text-mist transition-colors hover:bg-white/[0.06] hover:text-white"
      >
        {avatar ?? (
          <span
            aria-hidden
            className="grid size-8 place-items-center rounded-full border border-electric/40 bg-electric/15 font-display text-sm font-semibold text-electric-soft"
          >
            {initialOf(name ?? email)}
          </span>
        )}
        <ChevronDown aria-hidden className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label="Conta"
            onKeyDown={onMenuKeyDown}
            initial={reduceMotion ? false : { opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16 }}
            className="absolute top-full right-0 z-50 mt-2 w-60 origin-top-right rounded-2xl border border-line-strong bg-surface p-1.5 shadow-2xl shadow-black/60"
          >
            <p className="truncate border-b border-line px-3 pt-2 pb-3 text-xs text-mist" title={email}>
              Conectado como
              <span className="mt-0.5 block truncate text-sm font-medium text-white">{name ?? email}</span>
              {name && <span className="block truncate">{email}</span>}
              {badge}
            </p>
            <div className="pt-1.5">
              {items.map((item) => {
                const content = (
                  <>
                    <item.icon aria-hidden className="size-4" /> {item.label}
                  </>
                );
                const className = cn(itemClass, item.danger && dangerClass);
                if ("to" in item) {
                  return item.external ? (
                    <a key={item.key} role="menuitem" tabIndex={-1} href={item.to} target="_blank" rel="noreferrer" onClick={close} className={className}>
                      {content}
                    </a>
                  ) : (
                    <Link key={item.key} role="menuitem" tabIndex={-1} to={item.to} onClick={close} className={className}>
                      {content}
                    </Link>
                  );
                }
                return (
                  <button
                    key={item.key}
                    role="menuitem"
                    tabIndex={-1}
                    type="button"
                    onClick={() => {
                      close();
                      item.onSelect();
                    }}
                    className={className}
                  >
                    {content}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
