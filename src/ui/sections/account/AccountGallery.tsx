import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BadgeDollarSign, BarChart3, ChevronLeft, ChevronRight, ImageIcon, Info, ShoppingBag, UserRound, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { Account } from "@/domain/account";
import { AccountAvatar } from "@/ui/components/account/AccountAvatar";
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

/** O print como veio do celular ou do computador: cantos arredondados, sem moldura de aparelho. */
function ScreenshotStage({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={src}
      alt={alt}
      decoding="async"
      className="block h-auto max-h-[28rem] sm:max-h-[34rem] w-auto max-w-[min(100%,40rem)] rounded-[1.75rem] object-contain shadow-[0_40px_120px_-30px_rgb(39_153_255/0.45)] ring-1 ring-white/15"
    />
  );
}

/** Conta ainda sem print: mostra a foto e avisa, sem inventar uma tela. */
function NoPrintsStage({ account }: { account: Account }) {
  return (
    <div className="flex max-w-[16rem] flex-col items-center gap-4 text-center">
      <AccountAvatar account={account} className="size-24 text-2xl ring-1 ring-white/15" />
      <p className="text-sm text-mist">Os prints desta conta chegam em breve. Peça pelo WhatsApp que a gente manda na hora.</p>
    </div>
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

/** Só prints reais, na ordem do Jota; a Central ilustrativa entra logo depois do primeiro. */
function viewsOf(account: Account): GalleryView[] {
  const plan = galleryPlanOf({ platform: account.platform, monetized: account.stats.monetized });
  const prints = account.images.map((src, index): GalleryView => {
    const label = printLabelOf(plan, index);
    return {
      id: `print-${index}`,
      label,
      icon: printIconOf(label),
      caption: `${label}: print real da conta enviado pela Jota Digitais.`,
      stage: <ScreenshotStage src={src} alt={`${label} da conta ${account.handle}`} />,
    };
  });
  if (prints.length === 0) {
    return [{ id: "empty", label: "Prints", icon: ImageIcon, caption: "", stage: <NoPrintsStage account={account} /> }];
  }
  return plan.showCentral ? [...prints.slice(0, 1), CENTRAL_VIEW, ...prints.slice(1)] : prints;
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
  const views = viewsOf(account);
  const [activeId, setActiveId] = useState(views[0]?.id ?? "empty");
  const reduceMotion = useReducedMotion();
  const active = views.find((view) => view.id === activeId) ?? views[0];

  return (
    <div className="lg:sticky lg:top-24 lg:self-start">
      <div className="relative flex min-h-[26rem] items-center justify-center overflow-hidden rounded-3xl border border-line bg-surface/60 py-8 sm:min-h-[36rem] sm:rounded-[2rem] sm:py-12">
        <div aria-hidden className="absolute inset-0">
          <div className="absolute top-10 left-1/2 size-72 -translate-x-1/2 rounded-full bg-electric/20 blur-[100px]" />
          <div className="absolute bottom-0 left-10 size-48 rounded-full bg-pink/15 blur-[90px]" />
          <div className="absolute inset-0 bg-grid opacity-40" />
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active?.id}
            className="relative flex max-w-full justify-center px-4"
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
    </div>
  );
}
