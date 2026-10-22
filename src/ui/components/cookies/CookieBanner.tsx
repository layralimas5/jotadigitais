import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Cookie } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { COOKIE_CATEGORY_VIEW, OPTIONAL_COOKIE_CATEGORIES, type OptionalCookieCategory } from "@/domain/cookie-consent";
import { Button } from "@/ui/components/Button";
import { cn } from "@/ui/lib/cn";
import { EASE_OUT_EXPO } from "@/ui/lib/motion";
import { IS_SITE_PREVIEW } from "@/ui/lib/site-preview";
import { useCookieConsent } from "./CookieConsentProvider";

const ALL_ON: Record<OptionalCookieCategory, boolean> = { analytics: true, marketing: true };
const ALL_OFF: Record<OptionalCookieCategory, boolean> = { analytics: false, marketing: false };

function CategorySwitch({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex items-center justify-between gap-4 rounded-2xl border border-line-strong bg-ink px-4 py-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-electric",
        disabled ? "cursor-not-allowed" : "cursor-pointer",
      )}
    >
      <span>
        <span className="block text-sm font-semibold text-white">{label}</span>
        <span id={`${id}-description`} className="mt-0.5 block text-xs leading-relaxed text-mist">
          {description}
        </span>
      </span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        aria-describedby={`${id}-description`}
        onChange={(event) => onChange?.(event.target.checked)}
        className="sr-only"
      />
      <span aria-hidden className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", checked ? "bg-electric" : "bg-line-strong", disabled && "opacity-60")}>
        <span className={cn("absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform", checked && "translate-x-5")} />
      </span>
    </label>
  );
}

function CookiePreferencesDialog() {
  const { consent, decide, preferencesOpen, closePreferences } = useCookieConsent();
  const ref = useRef<HTMLDialogElement>(null);
  const [choice, setChoice] = useState<Record<OptionalCookieCategory, boolean>>(ALL_OFF);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (preferencesOpen && !dialog.open) {
      setChoice(consent ? { analytics: consent.analytics, marketing: consent.marketing } : ALL_OFF);
      dialog.showModal();
    }
    if (!preferencesOpen && dialog.open) dialog.close();
  }, [preferencesOpen, consent]);

  return (
    <dialog
      ref={ref}
      onClose={closePreferences}
      aria-labelledby="cookie-preferences-title"
      className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-3xl border border-line-strong bg-surface p-6 text-white backdrop:bg-black/70 backdrop:backdrop-blur-sm max-sm:mb-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
    >
      <h2 id="cookie-preferences-title" className="font-display text-lg font-semibold">
        Preferências de cookies
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-mist">
        Escolha o que pode ficar guardado no seu navegador. Você muda isso quando quiser pelo rodapé. Detalhes na{" "}
        <Link to="/politica-de-privacidade#cookies" onClick={closePreferences} className="text-electric-soft underline underline-offset-4">
          Política de Privacidade
        </Link>
        .
      </p>
      <div className="mt-5 space-y-2.5">
        <CategorySwitch {...COOKIE_CATEGORY_VIEW.necessary} checked disabled />
        {OPTIONAL_COOKIE_CATEGORIES.map((category) => (
          <CategorySwitch
            key={category}
            {...COOKIE_CATEGORY_VIEW[category]}
            checked={choice[category]}
            onChange={(checked) => setChoice((current) => ({ ...current, [category]: checked }))}
          />
        ))}
      </div>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={() => decide(choice)}>
          Salvar escolhas
        </Button>
        <Button onClick={() => decide(ALL_ON)}>Aceitar todos</Button>
      </div>
    </dialog>
  );
}

/** Aviso de cookies com as três saídas exigidas: aceitar todos, rejeitar os não essenciais ou configurar. */
export function CookieBanner() {
  const { consent, decide, openPreferences } = useCookieConsent();
  const reduceMotion = useReducedMotion();
  if (IS_SITE_PREVIEW) return null;

  return (
    <>
      <AnimatePresence>
        {consent === null && (
          <motion.section
            aria-labelledby="cookie-banner-title"
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
            transition={{ duration: 0.45, ease: EASE_OUT_EXPO }}
            className="fixed inset-x-3 bottom-3 z-50 rounded-3xl border border-line-strong bg-surface/95 p-5 shadow-[0_24px_80px_-20px_rgb(0_0_0/0.9)] backdrop-blur-xl sm:inset-x-auto sm:left-6 sm:bottom-6 sm:max-w-md"
          >
            <h2 id="cookie-banner-title" className="flex items-center gap-2 font-display text-base font-semibold text-white">
              <Cookie aria-hidden className="size-5 text-electric" /> Sua privacidade
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-mist">
              Usamos só o necessário para o site funcionar. Cookies analíticos e de marketing ficam desligados até você
              permitir. Saiba mais na{" "}
              <Link to="/politica-de-privacidade#cookies" className="text-electric-soft underline underline-offset-4">
                Política de Privacidade
              </Link>
              .
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Button onClick={() => decide(ALL_ON)}>Aceitar todos</Button>
              <Button variant="secondary" onClick={() => decide(ALL_OFF)}>
                Rejeitar não essenciais
              </Button>
              <Button variant="ghost" onClick={openPreferences} className="sm:col-span-2">
                Configurar
              </Button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
      <CookiePreferencesDialog />
    </>
  );
}
