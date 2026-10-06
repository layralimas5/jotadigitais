import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ShoppingBag, UserRound } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { TikTokAccount } from "@/domain/account";
import { PhoneProfile } from "@/ui/components/account/PhoneProfile";
import { cn } from "@/ui/lib/cn";
import { EASE_OUT_EXPO } from "@/ui/lib/motion";

type ViewId = "profile" | "central";

interface GalleryView {
  id: ViewId;
  label: string;
  icon: typeof UserRound;
  caption: string;
}

const VIEWS: GalleryView[] = [
  { id: "profile", label: "Perfil", icon: UserRound, caption: "Prévia do perfil com os números reais da conta." },
  {
    id: "central",
    label: "Central de Criadores",
    icon: ShoppingBag,
    caption: "Imagem ilustrativa da Central de Criadores do TikTok Shop, que já vem ativa.",
  },
];

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

export function AccountGallery({ account }: { account: TikTokAccount }) {
  const [active, setActive] = useState<ViewId>("profile");
  const reduceMotion = useReducedMotion();
  const caption = VIEWS.find((view) => view.id === active)?.caption;

  const stage: Record<ViewId, ReactNode> = {
    profile: <PhoneProfile account={account} />,
    central: <CentralPreview />,
  };

  return (
    <div className="lg:sticky lg:top-24 lg:self-start">
      <div className="relative flex min-h-[36rem] items-center justify-center overflow-hidden rounded-[2rem] border border-line bg-surface/60 py-12">
        <div aria-hidden className="absolute inset-0">
          <div className="absolute top-10 left-1/2 size-72 -translate-x-1/2 rounded-full bg-electric/20 blur-[100px]" />
          <div className="absolute bottom-0 left-10 size-48 rounded-full bg-pink/15 blur-[90px]" />
          <div className="absolute inset-0 bg-grid opacity-40" />
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active}
            className="relative"
            initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
          >
            {stage[active]}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-4 flex gap-3" role="group" aria-label="Imagens da conta">
        {VIEWS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-pressed={active === id}
            onClick={() => setActive(id)}
            className={cn(
              "flex flex-1 items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-colors",
              active === id
                ? "border-electric/60 bg-electric/10 text-white"
                : "border-line bg-surface/60 text-mist hover:border-line-strong hover:text-white",
            )}
          >
            <span
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-xl",
                active === id ? "bg-electric text-ink" : "bg-white/[0.06]",
              )}
            >
              <Icon aria-hidden className="size-4" />
            </span>
            {label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-mist" aria-live="polite">
        {caption}
      </p>
    </div>
  );
}
