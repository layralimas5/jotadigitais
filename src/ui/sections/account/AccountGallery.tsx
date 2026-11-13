import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BadgeDollarSign, BarChart3, ChevronLeft, ChevronRight, ImageIcon, Info, Maximize2, ShoppingBag, UserRound, type LucideIcon } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";
import { shopTierOf, type Account } from "@/domain/account";
import { PLATFORM_LABEL } from "@/domain/platform";
import { PhoneProfile } from "@/ui/components/account/PhoneProfile";
import { PhoneScreenshot } from "@/ui/components/account/PhoneScreenshot";
import { ImageLightbox, type LightboxImage } from "@/ui/components/ImageLightbox";
import { useDragScroll } from "@/ui/hooks/useDragScroll";
import { galleryPlanOf, printLabelOf } from "@/ui/lib/account-presenter";
import { cn } from "@/ui/lib/cn";
import { EASE_OUT_EXPO } from "@/ui/lib/motion";

interface GalleryView {
  id: string;
  label: string;
  icon: LucideIcon;
  caption: string;
  stage: ReactNode;
}

function CentralPreview() {
  return (
    <div className="relative w-[17.5rem] overflow-hidden rounded-[2.6rem] border border-white/15 bg-zinc-950 p-2.5 shadow-[0_40px_120px_-30px_rgb(255_102_196/0.45)]">
      <img
        src="/images/tiktok-shop-central.webp"
        alt="Tela da Central de Criadores do TikTok Shop com o passo a passo para publicar o primeiro vídeo com produtos."
        width={738}
        height={880}
        decoding="async"
        className="w-full rounded-[2.1rem]"
      />
    </div>
  );
}

/** Abre o print em tela cheia: o Studio do YouTube e os números pequenos ficam legíveis. */
type ZoomPrint = (printIndex: number) => void;

/** O que a galeria sabe dos prints depois de carregar cada um: quais são deitados. */
interface PrintShapes {
  landscape: ReadonlySet<number>;
  measure: (printIndex: number, landscape: boolean) => void;
}

/**
 * O print como veio do celular ou do computador: cantos arredondados, sem moldura de aparelho.
 * Print deitado (Studio do YouTube, tela de computador) ocupa a largura toda do quadro; em pé, a altura.
 */
interface ScreenshotStageProps {
  src: string;
  alt: string;
  landscape: boolean;
  onMeasure: (landscape: boolean) => void;
  onZoom: () => void;
}

function ScreenshotStage({ src, alt, landscape, onMeasure, onZoom }: ScreenshotStageProps) {
  return (
    <button
      type="button"
      onClick={onZoom}
      aria-label={`Ampliar: ${alt}`}
      className={cn(
        "group relative block cursor-zoom-in rounded-[1.75rem] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-electric",
        landscape && "w-full",
      )}
    >
      <img
        src={src}
        alt={alt}
        decoding="async"
        onLoad={(event) => onMeasure(event.currentTarget.naturalWidth > event.currentTarget.naturalHeight)}
        className={cn(
          "block h-auto object-contain shadow-[0_40px_120px_-30px_rgb(39_153_255/0.45)] ring-1 ring-white/15",
          landscape
            ? "w-full rounded-xl sm:rounded-2xl"
            : "max-h-[28rem] w-auto max-w-[min(100%,40rem)] rounded-[1.75rem] sm:max-h-[34rem]",
        )}
      />
      <ZoomHint />
    </button>
  );
}

function ZoomHint() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-full bg-black/75 px-2.5 py-1 text-[0.7rem] font-medium text-white ring-1 ring-white/15 backdrop-blur transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100"
    >
      <Maximize2 className="size-3" /> Ampliar
    </span>
  );
}

/** Ícone pelo assunto do print: perfil, dinheiro, números ou informação. */
function printIconOf(label: string): LucideIcon {
  if (/perfil/i.test(label)) return UserRound;
  if (/receita|monetiza/i.test(label)) return BadgeDollarSign;
  if (/an[aá]lise|resumo/i.test(label)) return BarChart3;
  if (/informa/i.test(label)) return Info;
  return ImageIcon;
}

const CENTRAL_VIEW: GalleryView = {
  id: "central",
  label: "Central de Criadores",
  icon: ShoppingBag,
  caption: "Imagem ilustrativa da Central de Criadores do TikTok Shop, que já vem ativa.",
  stage: <CentralPreview />,
};

/** No TikTok e no Instagram o primeiro print que o Jota sobe é a tela do perfil: ela vai dentro do celular. */
const profilePrintOf = (account: Account): string | null =>
  account.platform === "tiktok" || account.platform === "instagram" ? (account.images[0] ?? null) : null;

/** O celular abre a galeria: com o print real do perfil quando existe; sem ele, a prévia montada com os números puxados da rede. */
function mockupViewOf(account: Account, profilePrint: string | null, onZoom: ZoomPrint): GalleryView {
  const network = PLATFORM_LABEL[account.platform];
  return {
    id: "profile",
    label: account.platform === "youtube" ? "Canal" : "Perfil",
    icon: UserRound,
    caption: profilePrint
      ? `Print real do perfil no ${network}, enviado pela Jota Digitais.`
      : `Prévia do perfil no ${network} com os números reais da conta.`,
    stage: profilePrint ? (
      <button
        type="button"
        onClick={() => onZoom(0)}
        aria-label={`Ampliar o print do perfil da conta ${account.handle}`}
        className="group relative block cursor-zoom-in rounded-[2.6rem] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-electric"
      >
        <PhoneScreenshot src={profilePrint} alt={`Print do perfil da conta ${account.handle} no ${network}`} />
        <ZoomHint />
      </button>
    ) : (
      <PhoneProfile account={account} />
    ),
  };
}

/** O celular do perfil abre a galeria; depois os outros prints, na ordem do Jota, com a Central ilustrativa logo após o primeiro. */
const planOf = (account: Account) =>
  galleryPlanOf({
    platform: account.platform,
    monetized: account.stats.monetized,
    hasShop: account.platform !== "tiktok" || shopTierOf(account) !== "none",
  });

function viewsOf(account: Account, onZoom: ZoomPrint, shapes: PrintShapes): GalleryView[] {
  const plan = planOf(account);
  const prints = account.images.map((src, index): GalleryView => {
    const label = printLabelOf(plan, index);
    return {
      id: `print-${index}`,
      label,
      icon: printIconOf(label),
      caption: `${label}: print real da conta enviado pela Jota Digitais.`,
      stage: (
        <ScreenshotStage
          src={src}
          alt={`${label} da conta ${account.handle}`}
          landscape={shapes.landscape.has(index)}
          onMeasure={(landscape) => shapes.measure(index, landscape)}
          onZoom={() => onZoom(index)}
        />
      ),
    };
  });
  const central = plan.showCentral ? [CENTRAL_VIEW] : [];
  const profilePrint = profilePrintOf(account);
  // O print do perfil já está no celular: não repete numa aba própria.
  const otherPrints = profilePrint ? prints.slice(1) : prints;
  return [mockupViewOf(account, profilePrint, onZoom), ...central, ...otherPrints];
}

const ARROW =
  "absolute top-1/2 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full border border-line-strong bg-surface-2/95 text-white shadow-lg backdrop-blur transition-colors hover:border-electric hover:text-electric-soft focus-visible:outline-2 focus-visible:outline-electric";

/** Fileira de cards da galeria: arrasta com o mouse ou o dedo, e as setas aparecem quando tem card escondido. */
function GalleryTabs({ views, activeId, onSelect }: { views: GalleryView[]; activeId: string; onSelect: (id: string) => void }) {
  const strip = useDragScroll<HTMLDivElement>();
  // Esmaece só o lado em que ainda tem card escondido.
  const left = strip.edges.start ? "transparent 0, black 3rem" : "black 0";
  const right = strip.edges.end ? "black calc(100% - 3rem), transparent 100%" : "black 100%";

  return (
    <div className="relative mt-4">
      {strip.edges.start && (
        <button type="button" onClick={() => strip.page(-1)} aria-label="Ver imagens anteriores" className={cn(ARROW, "left-1")}>
          <ChevronLeft aria-hidden className="size-4" />
        </button>
      )}
      <div
        ref={strip.ref}
        {...strip.handlers}
        role="group"
        aria-label="Imagens da conta"
        className={cn("flex gap-3 overflow-x-auto pb-1 select-none [scrollbar-width:none]", strip.dragging ? "cursor-grabbing" : "cursor-grab")}
        style={{ maskImage: `linear-gradient(to right, ${left}, ${right})` }}
      >
        {views.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-pressed={activeId === id}
            onClick={(event) => {
              onSelect(id);
              event.currentTarget.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
            }}
            draggable={false}
            className={cn(
              "flex min-w-fit flex-1 items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-colors",
              activeId === id
                ? "border-electric/60 bg-electric/10 text-white"
                : "border-line bg-surface/60 text-mist hover:border-line-strong hover:text-white",
            )}
          >
            <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", activeId === id ? "bg-electric text-ink" : "bg-white/[0.06]")}>
              <Icon aria-hidden className="size-4" />
            </span>
            {label}
          </button>
        ))}
      </div>
      {strip.edges.end && (
        <button type="button" onClick={() => strip.page(1)} aria-label="Ver mais imagens" className={cn(ARROW, "right-1")}>
          <ChevronRight aria-hidden className="size-4" />
        </button>
      )}
    </div>
  );
}

export function AccountGallery({ account }: { account: Account }) {
  const [zoomed, setZoomed] = useState<number | null>(null);
  const [landscape, setLandscape] = useState<ReadonlySet<number>>(() => new Set());
  const measure = useCallback((printIndex: number, isLandscape: boolean) => {
    setLandscape((current) => {
      if (current.has(printIndex) === isLandscape) return current;
      const next = new Set(current);
      if (isLandscape) next.add(printIndex);
      else next.delete(printIndex);
      return next;
    });
  }, []);
  const views = viewsOf(account, setZoomed, { landscape, measure });
  const plan = planOf(account);
  const lightboxImages: LightboxImage[] = account.images.map((url, index) => ({
    url,
    name: `${printLabelOf(plan, index)} da conta ${account.handle}`,
  }));
  const [activeId, setActiveId] = useState(views[0]?.id ?? "profile");
  const reduceMotion = useReducedMotion();
  const active = views.find((view) => view.id === activeId) ?? views[0];
  const activeIsLandscape = active?.id.startsWith("print-") === true && landscape.has(Number(active.id.slice("print-".length)));

  return (
    <div className="lg:sticky lg:top-24 lg:self-start">
      <div
        className={cn(
          "relative flex items-center justify-center overflow-hidden rounded-3xl border border-line bg-surface/60 transition-[min-height] duration-300 sm:rounded-[2rem]",
          // Print deitado não precisa da altura do celular: o quadro encolhe e o print não fica perdido no meio.
          activeIsLandscape ? "min-h-0 py-6 sm:py-10" : "min-h-[26rem] py-8 sm:min-h-[36rem] sm:py-12",
        )}
      >
        <div aria-hidden className="absolute inset-0">
          <div className="absolute top-10 left-1/2 size-72 -translate-x-1/2 rounded-full bg-electric/20 blur-[100px]" />
          <div className="absolute bottom-0 left-10 size-48 rounded-full bg-pink/15 blur-[90px]" />
          <div className="absolute inset-0 bg-grid opacity-40" />
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active?.id}
            className={cn("relative flex w-full justify-center px-3 sm:px-6", active?.id === "profile" && "max-sm:[zoom:0.8]")}
            initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
          >
            {active?.stage}
          </motion.div>
        </AnimatePresence>
      </div>

      {views.length > 1 && <GalleryTabs views={views} activeId={active?.id ?? ""} onSelect={setActiveId} />}
      <p className="mt-3 text-xs text-mist" aria-live="polite">
        {active?.caption}
      </p>
      <ImageLightbox images={lightboxImages} index={zoomed} onChange={setZoomed} />
    </div>
  );
}
