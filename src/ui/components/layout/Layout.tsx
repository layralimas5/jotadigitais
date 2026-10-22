import { Suspense, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { CookieBanner } from "@/ui/components/cookies/CookieBanner";
import { CookieConsentProvider } from "@/ui/components/cookies/CookieConsentProvider";
import { WhatsAppWidget } from "@/ui/components/whatsapp/WhatsAppWidget";
import { SiteContentProvider } from "@/ui/hooks/useSiteContent";
import { StoreSettingsProvider } from "@/ui/hooks/useStoreSettings";
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
      <a
        href="#conteudo"
        className="sr-only z-[60] rounded-full bg-electric px-4 py-2 font-semibold text-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Pular para o conteúdo
      </a>
      <ScrollManager />
      <Header />
      <main id="conteudo" className="relative min-h-screen">
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
      <WhatsAppWidget />
      <CookieBanner />
      </CookieConsentProvider>
      </SiteContentProvider>
    </StoreSettingsProvider>
  );
}
