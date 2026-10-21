import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, LogOut, Settings, ShieldUser } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/ui/lib/cn";
import { useCloseOnOutsideClick } from "../lib/use-close-on-outside";
import { SETTINGS_PATH } from "../navigation";
import { useAdminSession } from "../session";
import { RoleBadge } from "./RoleBadge";

const itemClass =
  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-fog transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:bg-white/[0.06] focus-visible:text-white focus-visible:outline-none";

function initialOf(email: string): string {
  return email.trim().charAt(0).toUpperCase() || "J";
}

/** Ícone do usuário no canto superior direito: Configurações, Usuários e Sair. */
export function UserMenu() {
  const { state, signOut } = useAdminSession();
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

  if (state.status !== "signed-in") return null;
  const { email, name, role } = state.session;

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>("[role='menuitem']") ?? []);
    const current = items.indexOf(document.activeElement as HTMLElement);
    const focusAt = (index: number) => items[(index + items.length) % items.length]?.focus();
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
        focusAt(items.length - 1);
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
        <span
          aria-hidden
          className="grid size-8 place-items-center rounded-full border border-electric/40 bg-electric/15 font-display text-sm font-semibold text-electric-soft"
        >
          {initialOf(name ?? email)}
        </span>
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
              <RoleBadge role={role} className="mt-2" />
            </p>
            <div className="pt-1.5">
              <Link role="menuitem" tabIndex={-1} to={SETTINGS_PATH} onClick={close} className={itemClass}>
                <Settings aria-hidden className="size-4" /> Configurações
              </Link>
              <Link role="menuitem" tabIndex={-1} to="/admin/usuarios" onClick={close} className={itemClass}>
                <ShieldUser aria-hidden className="size-4" /> Usuários
              </Link>
              <button
                role="menuitem"
                tabIndex={-1}
                type="button"
                onClick={() => void signOut()}
                className={cn(itemClass, "text-[#ff9a9a] hover:text-[#ffb3b3] focus-visible:text-[#ffb3b3]")}
              >
                <LogOut aria-hidden className="size-4" /> Sair
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
