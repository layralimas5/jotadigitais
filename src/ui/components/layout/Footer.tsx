import { Link } from "react-router-dom";
import { useSiteContent } from "@/ui/hooks/useSiteContent";
import { useStoreSettings } from "@/ui/hooks/useStoreSettings";
import { Logo } from "../Logo";

function InstagramGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </svg>
  );
}

const LINKS = [
  { to: "/contas", label: "Contas disponíveis" },
  { to: "/#como-funciona", label: "Como funciona" },
  { to: "/#garantia", label: "Garantia" },
  { to: "/termos", label: "Termos de compra" },
] as const;

export function Footer() {
  const year = new Date().getFullYear();
  const { instagramUrl, instagramHandle, whatsappUrl } = useStoreSettings();
  const { footer } = useSiteContent();
  return (
    <footer id="rodape" className="relative border-t border-line bg-night">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-8 px-4 py-10 sm:px-6 sm:py-14 md:grid-cols-[1.4fr_1fr_1fr] md:gap-10">
        <div className="col-span-2 md:col-span-1">
          <Logo />
          <p className="mt-4 max-w-xs text-sm text-mist sm:mt-5">
            {footer.tagline}
          </p>
          {footer.slogan && <p className="mt-4 text-sm text-fog italic sm:mt-6">{footer.slogan}</p>}
        </div>

        <nav aria-label="Rodapé">
          <p className="font-display text-sm font-semibold text-white">Loja</p>
          <ul className="mt-4 space-y-3">
            {LINKS.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className="text-sm text-mist transition-colors hover:text-white">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <p className="font-display text-sm font-semibold text-white">Contato</p>
          <ul className="mt-4 space-y-3">
            <li>
              <a
                href={instagramUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm text-mist transition-colors hover:text-white"
              >
                <InstagramGlyph /> {instagramHandle}
              </a>
            </li>
            {whatsappUrl && (
              <li>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-mist transition-colors hover:text-white"
                >
                  Suporte no WhatsApp
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs leading-relaxed text-mist sm:gap-3 sm:px-6 sm:py-6 md:flex-row md:items-center md:justify-between">
          <p>
            © {year} Jota Digitais. {footer.disclaimer}
          </p>
          <p>
            Desenvolvido por{" "}
            <a
              href="https://limadigitalstudio.com.br"
              target="_blank"
              rel="noreferrer"
              className="text-fog underline-offset-4 hover:text-white hover:underline"
            >
              Layra Lima
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
