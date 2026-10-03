import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { cn } from "@/ui/lib/cn";
import { ButtonLink } from "../Button";
import { Logo } from "../Logo";

const NAV_ITEMS = [
  { to: "/contas", label: "Contas" },
  { to: "/#como-funciona", label: "Como funciona" },
  { to: "/#garantia", label: "Garantia" },
  { to: "/#duvidas", label: "Dúvidas" },
] as const;

function useScrolled(threshold = 12) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}

export function Header() {
  const scrolled = useScrolled();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const reduceMotion = useReducedMotion();

  useEffect(() => setOpen(false), [location.pathname, location.hash]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled || open ? "border-b border-white/[0.06] bg-black/70 backdrop-blur-xl" : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" aria-label="Jota Digitais, página inicial" className="rounded-md">
          <Logo />
        </Link>

        <nav aria-label="Principal" className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "rounded-full px-4 py-2 text-sm text-fog transition-colors hover:text-white",
                  isActive && item.to === "/contas" && "text-white",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ButtonLink to="/contas" className="hidden sm:inline-flex">
            Ver contas
          </ButtonLink>
          <button
            type="button"
            className="grid size-10 place-items-center rounded-full text-white hover:bg-white/[0.06] md:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            id="mobile-menu"
            aria-label="Menu"
            initial={reduceMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduceMotion ? undefined : { opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden md:hidden"
          >
            <ul className="space-y-1 px-4 pt-2 pb-6">
              {NAV_ITEMS.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="block rounded-xl px-3 py-3 font-display text-lg text-white hover:bg-white/[0.05]"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li className="pt-3">
                <ButtonLink to="/contas" size="lg" className="w-full">
                  Ver contas disponíveis
                </ButtonLink>
              </li>
            </ul>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
