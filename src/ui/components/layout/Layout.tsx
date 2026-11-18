import { Suspense, useEffect, useState, type ReactNode } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { CookieBanner } from "@/ui/components/cookies/CookieBanner";
import { CookieConsentProvider } from "@/ui/components/cookies/CookieConsentProvider";
import { WhatsAppWidget } from "@/ui/components/whatsapp/WhatsAppWidget";
import { CartProvider } from "@/ui/hooks/useCart";
import { SiteContentProvider, useSiteContentReady } from "@/ui/hooks/useSiteContent";
import { StoreSettingsProvider, useStoreSettingsReady } from "@/ui/hooks/useStoreSettings";
import { Footer } from "./Footer";
import { Header } from "./Header";

function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView();
      return;
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

/** Tempo máximo esperando o banco na primeira visita; passou disso, o site aparece com o texto original. */
const FIRST_VISIT_WAIT_MS = 2500;

/**
 * Primeira visita (sem cópia no navegador): o site fica invisível, ocupando o lugar, até os textos salvos chegarem.
 * Assim ninguém vê o texto de fábrica trocar pelo editado. Quem já visitou abre na hora, com a cópia.
 */
function FirstVisitGate({ children }: { children: ReactNode }) {
  // Os dois hooks rodam sempre, na mesma ordem (o && pulava o segundo e o React reclamava).
  const contentReady = useSiteContentReady();
  const settingsReady = useStoreSettingsReady();
  const ready = contentReady && settingsReady;
  const [waitedEnough, setWaitedEnough] = useState(false);
  useEffect(() => {
    if (ready) return;
    const timer = window.setTimeout(() => setWaitedEnough(true), FIRST_VISIT_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [ready]);
  const visible = ready || waitedEnough;
  return (
    <div className="contents" style={visible ? undefined : { visibility: "hidden" }} aria-busy={!visible || undefined}>
      {children}
    </div>
  );
}

function PageFallback() {
  return (
    <div className="grid min-h-[60vh] place-items-center" role="status" aria-label="Carregando">
      <span className="size-8 animate-spin rounded-full border-2 border-white/15 border-t-electric" />
    </div>
  );
}

export function Layout() {
  return (
    <StoreSettingsProvider>
      <SiteContentProvider>
      <CookieConsentProvider>
      <CartProvider>
      <a
        href="#conteudo"
        className="sr-only z-[60] rounded-full bg-electric px-4 py-2 font-semibold text-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Pular para o conteúdo
      </a>
      <ScrollManager />
      <FirstVisitGate>
      <Header />
      <main id="conteudo" className="relative min-h-screen">
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
      <WhatsAppWidget />
      <CookieBanner />
      </FirstVisitGate>
      </CartProvider>
      </CookieConsentProvider>
      </SiteContentProvider>
    </StoreSettingsProvider>
  );
}
