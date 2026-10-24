import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { ButtonLink } from "@/ui/components/Button";
import { PhoneProfile, type ProfilePreview } from "@/ui/components/account/PhoneProfile";
import { Backdrop } from "@/ui/components/layout/Backdrop";
import { TikTokGlyph } from "@/ui/components/TikTokGlyph";
import { VerifiedBadge } from "@/ui/components/VerifiedBadge";
import { useSiteContent } from "@/ui/hooks/useSiteContent";
import { OTHER_NETWORKS_CATALOG_PATH } from "@/ui/lib/catalog-links";
import { cn } from "@/ui/lib/cn";
import { EASE_OUT_EXPO, fadeUp, staggerContainer } from "@/ui/lib/motion";
import { proofIconComponent } from "@/ui/lib/proof-icons";
import { editable } from "@/ui/lib/site-preview";

const previewOf = (name: string, handle: string): ProfilePreview => ({
  id: "hero-preview",
  platform: "tiktok",
  displayName: name,
  handle,
  followers: 1259,
  stats: { likes: 2123, following: 0, monetized: false },
});

const FLOAT_DURATION_S = 3.2;
const FLOAT_DISTANCE_PX = 10;

interface FloatingChipProps {
  positionClassName: string;
  className: string;
  children: React.ReactNode;
  delay: number;
  /** Defasagem do ciclo para os selos não subirem juntos. */
  floatOffset?: number;
}

/** Entra com fade e depois fica flutuando, subindo e descendo sem parar. */
function FloatingChip({ positionClassName, className, children, delay, floatOffset = 0 }: FloatingChipProps) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className={cn("absolute", positionClassName)}
      animate={reduceMotion ? undefined : { y: [0, -FLOAT_DISTANCE_PX, 0] }}
      transition={{ duration: FLOAT_DURATION_S, delay: delay + floatOffset, repeat: Infinity, ease: "easeInOut" }}
    >
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, delay, ease: EASE_OUT_EXPO }}
        className={className}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

export function Hero() {
  const reduceMotion = useReducedMotion();
  const { hero } = useSiteContent();
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden pt-24 pb-14 sm:pt-28 sm:pb-16 md:pt-36 md:pb-20">
      <Backdrop />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 sm:gap-16 sm:px-6 lg:grid-cols-[1.15fr_1fr]">
        <motion.div
          variants={reduceMotion ? undefined : staggerContainer}
          initial="hidden"
          animate="show"
          className="text-center lg:text-left"
        >
          <motion.div variants={fadeUp}>
            <Link
              to={OTHER_NETWORKS_CATALOG_PATH}
              className="group/badge inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1.5 pr-3 pl-1.5 text-[0.72rem] font-medium text-fog backdrop-blur transition-colors hover:border-white/25 hover:text-white sm:pr-3.5 sm:text-xs"
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white text-ink">
                <TikTokGlyph className="size-3.5" />
              </span>
              <span {...editable("hero.badge")}>{hero.badge}</span>
              <ArrowRight aria-hidden className="size-3.5 transition-transform group-hover/badge:translate-x-0.5" />
            </Link>
          </motion.div>

          <motion.h1
            id="hero-title"
            variants={fadeUp}
            className="mt-5 font-display text-hero font-semibold tracking-tight text-balance text-white sm:mt-7 sm:text-6xl sm:leading-[1.05] lg:text-[4.1rem]"
          >
            <span {...editable("hero.title")}>{hero.title}</span>
            {hero.titleHighlight && (
              <>
                {" "}
                <span {...editable("hero.titleHighlight")} className="text-gradient-brand">
                  {hero.titleHighlight}
                </span>
              </>
            )}
          </motion.h1>

          <motion.p
            variants={fadeUp}
            {...editable("hero.subtitle")}
            className="mx-auto mt-4 max-w-xl text-[0.95rem] leading-relaxed text-pretty text-mist sm:mt-6 sm:text-lg lg:mx-0"
          >
            {hero.subtitle}
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="mt-7 flex flex-col items-center gap-1 sm:mt-9 sm:flex-row sm:justify-center sm:gap-3 lg:justify-start"
          >
            <ButtonLink to="/contas" size="lg" className="w-full sm:w-auto" {...editable("hero.primaryCta")}>
              {hero.primaryCta}
              <ArrowRight className="size-4 transition-transform group-hover/btn:translate-x-0.5" />
            </ButtonLink>
            <ButtonLink
              to="/#como-funciona"
              {...editable("hero.secondaryCta")}
              variant="secondary"
              size="lg"
              className="max-sm:h-11 max-sm:border-transparent max-sm:bg-transparent max-sm:text-fog sm:w-auto"
            >
              {hero.secondaryCta}
            </ButtonLink>
          </motion.div>

          <motion.ul
            variants={fadeUp}
            className="mt-5 flex flex-wrap items-center justify-center gap-x-3.5 gap-y-2 text-[0.78rem] text-fog sm:mt-10 sm:gap-x-6 sm:gap-y-3 sm:text-sm lg:justify-start"
          >
            {hero.proofPoints.map((point, index) => {
              const Icon = proofIconComponent(point);
              return (
                <li key={index} {...editable(`hero.proofPoints.${index}.text`)} className="flex items-center gap-1.5 sm:gap-2">
                  <Icon aria-hidden className="size-3.5 text-electric sm:size-4" />
                  {point.text}
                </li>
              );
            })}
          </motion.ul>
        </motion.div>

        {/* No celular o mockup sai: título, frase e botão cabem na primeira tela. */}
        <div className="relative mx-auto max-sm:hidden">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 40, rotate: -4 }}
            animate={{ opacity: 1, y: 0, rotate: -3 }}
            transition={{ duration: 0.9, delay: 0.15, ease: EASE_OUT_EXPO }}
          >
            <div {...editable("hero.phoneName")}>
              <PhoneProfile account={previewOf(hero.phoneName, hero.phoneHandle)} />
            </div>
          </motion.div>

          <FloatingChip
            delay={0.6}
            positionClassName="top-[38%] -left-28"
            className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-surface/90 px-3.5 py-2.5 shadow-2xl shadow-black/50 backdrop-blur"
          >
            <VerifiedBadge className="size-7" />
            <div>
              <p {...editable("hero.chipTitle")} className="text-xs font-semibold text-white">
                {hero.chipTitle}
              </p>
              <p {...editable("hero.chipText")} className="text-[0.68rem] text-mist">
                {hero.chipText}
              </p>
            </div>
          </FloatingChip>

          <FloatingChip
            delay={0.8}
            floatOffset={FLOAT_DURATION_S / 2}
            positionClassName="-right-20 -bottom-6"
            className="rounded-2xl border border-white/10 bg-surface/90 px-4 py-3 shadow-2xl shadow-black/50 backdrop-blur"
          >
            <p {...editable("hero.statLabel")} className="text-[0.68rem] text-mist">
              {hero.statLabel}
            </p>
            <p {...editable("hero.statValue")} className="font-display text-2xl font-bold text-alert">
              {hero.statValue}
            </p>
          </FloatingChip>
        </div>
      </div>
    </section>
  );
}
