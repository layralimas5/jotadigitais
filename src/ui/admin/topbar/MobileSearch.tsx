import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { GlobalSearch } from "./GlobalSearch";

/** No celular a busca vira um ícone; ao tocar, abre por cima da tela com o teclado já aberto. */
export function MobileSearch() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      triggerRef.current?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Buscar no sistema"
        className="grid size-10 place-items-center rounded-full text-mist hover:bg-white/[0.06] hover:text-white"
      >
        <Search aria-hidden className="size-[1.15rem]" />
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label="Buscar no sistema" className="fixed inset-0 z-[60] bg-black/95 px-4 pt-3 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <GlobalSearch autoFocus onNavigate={() => setOpen(false)} className="flex-1" />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar busca"
              className="grid size-10 shrink-0 place-items-center rounded-full text-mist hover:bg-white/[0.06] hover:text-white"
            >
              <X aria-hidden className="size-5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
