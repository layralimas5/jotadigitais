import { MessageCircle } from "lucide-react";
import { Suspense, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { siteConfig } from "@/app/config";
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

function WhatsAppButton() {
  if (!siteConfig.whatsappUrl) return null;
  return (
    <a
      href={siteConfig.whatsappUrl}
      target="_blank"
      rel="noreferrer"
      aria-label="Falar com o suporte no WhatsApp"
      className="fixed right-4 bottom-4 z-40 grid size-14 place-items-center rounded-full bg-[#25d366] text-ink shadow-lg shadow-black/40 transition-transform hover:scale-105 sm:right-6 sm:bottom-6"
    >
      <MessageCircle className="size-6" />
    </a>
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
    <>
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
      <WhatsAppButton />
    </>
  );
}
