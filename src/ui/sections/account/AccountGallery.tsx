import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ImageIcon, ShoppingBag, UserRound, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { Account } from "@/domain/account";
import { PLATFORM_LABEL } from "@/domain/platform";
import { PhoneProfile } from "@/ui/components/account/PhoneProfile";
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

function ScreenshotStage({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative w-[17.5rem] overflow-hidden rounded-[2.6rem] border border-white/15 bg-zinc-950 p-2.5 shadow-[0_40px_120px_-30px_rgb(39_153_255/0.45)]">
      <img src={src} alt={alt} decoding="async" className="max-h-[32rem] w-full rounded-[2.1rem] object-cover object-top" />
    </div>
  );
}

function viewsOf(account: Account): GalleryView[] {
  const views: GalleryView[] = [
    {
      id: "profile",
      label: "Perfil",
      icon: UserRound,
      caption: `Prévia do perfil no ${PLATFORM_LABEL[account.platform]} com os números reais da conta.`,
      stage: <PhoneProfile account={account} />,
    },
  ];
  if (account.platform === "tiktok") {
    views.push({
      id: "central",
      label: "Central de Criadores",
      icon: ShoppingBag,
      caption: "Imagem ilustrativa da Central de Criadores do TikTok Shop, que já vem ativa.",
      stage: <CentralPreview />,
    });
  }
  account.images.forEach((src, index) => {
    const label = `Print ${index + 1}`;
    views.push({
      id: `print-${index}`,
      label,
      icon: ImageIcon,
      caption: "Print real da conta enviado pela Jota Digitais.",
      stage: <ScreenshotStage src={src} alt={`${label} da conta ${account.handle}`} />,
    });
  });
  return views;
}

export function AccountGallery({ account }: { account: Account }) {
  const views = viewsOf(account);
  const [activeId, setActiveId] = useState(views[0]?.id ?? "profile");
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
            className="relative max-sm:[zoom:0.8]"
            initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
          >
            {active?.stage}
          </motion.div>
        </AnimatePresence>
      </div>

      {views.length > 1 && (
        <div className="mt-4 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]" role="group" aria-label="Imagens da conta">
          {views.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={activeId === id}
              onClick={() => setActiveId(id)}
              className={cn(
                "flex min-w-fit flex-1 items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-colors",
                activeId === id
                  ? "border-electric/60 bg-electric/10 text-white"
                  : "border-line bg-surface/60 text-mist hover:border-line-strong hover:text-white",
              )}
            >
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-xl",
                  activeId === id ? "bg-electric text-ink" : "bg-white/[0.06]",
                )}
              >
                <Icon aria-hidden className="size-4" />
              </span>
              {label}
            </button>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-mist" aria-live="polite">
        {active?.caption}
      </p>
    </div>
  );
}
