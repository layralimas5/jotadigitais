import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/ui/lib/cn";

type ToastTone = "success" | "error";

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  show: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
const VISIBLE_MS = 3200;

/** Avisos curtos depois de cada ação ("Status alterado", "Pedido entregue"). Ficam acima da barra de navegação no celular. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const reduceMotion = useReducedMotion();

  const show = useCallback((message: string, tone: ToastTone = "success") => {
    nextId.current += 1;
    const id = nextId.current;
    setToasts((current) => [...current.slice(-2), { id, message, tone }]);
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), VISIBLE_MS);
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-start gap-2 pr-[5.5rem] pl-4 md:bottom-28 md:items-center md:px-4"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <motion.p
              key={toast.id}
              layout={!reduceMotion}
              initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.22 }}
              role={toast.tone === "error" ? "alert" : "status"}
              className={cn(
                "flex max-w-sm items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium shadow-2xl shadow-black/60 backdrop-blur-xl",
                toast.tone === "success"
                  ? "border-emerald-400/30 bg-[#0c1a14]/95 text-emerald-200"
                  : "border-alert/40 bg-[#1f0b0b]/95 text-[#ffb3b3]",
              )}
            >
              {toast.tone === "success" ? (
                <CheckCircle2 aria-hidden className="size-4 shrink-0" />
              ) : (
                <AlertCircle aria-hidden className="size-4 shrink-0" />
              )}
              {toast.message}
            </motion.p>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast precisa estar dentro de ToastProvider.");
  return value;
}
