import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Mail, ShieldCheck, Wallet } from "lucide-react";
import { ButtonLink } from "@/ui/components/Button";
import { PhoneProfile } from "@/ui/components/account/PhoneProfile";
import { Backdrop } from "@/ui/components/layout/Backdrop";
import { TikTokGlyph } from "@/ui/components/TikTokGlyph";
import { VerifiedBadge } from "@/ui/components/VerifiedBadge";
import { cn } from "@/ui/lib/cn";
import { EASE_OUT_EXPO, fadeUp, staggerContainer } from "@/ui/lib/motion";

const HERO_PREVIEW = {
  id: "hero-preview",
  displayName: "Sua Loja Aqui",
  handle: "@sualoja.aqui",
  followers: 1259,
  likes: 2123,
  following: 0,
};

const PROOF_POINTS = [
  { icon: ShieldCheck, label: "Seguidores reais e brasileiros" },
  { icon: Wallet, label: "Pix ou até 12x no cartão" },
  { icon: Mail, label: "Acesso entregue no seu e-mail" },
] as const;

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
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden pt-28 pb-16 md:pt-36 md:pb-20">
      <Backdrop />
      <div className="relative mx-auto grid max-w-6xl items-center gap-16 px-4 sm:px-6 lg:grid-cols-[1.15fr_1fr]">
        <motion.div
          variants={reduceMotion ? undefined : staggerContainer}
          initial="hidden"
          animate="show"
          className="text-center lg:text-left"
        >
          <motion.p
            variants={fadeUp}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1.5 pr-4 pl-1.5 text-xs font-medium text-fog backdrop-blur"
          >
            <span className="grid size-6 place-items-center rounded-full bg-white text-ink">
              <TikTokGlyph className="size-3.5" />
            </span>
            Central de Criadores do TikTok Shop já liberada
          </motion.p>

          <motion.h1
            id="hero-title"
            variants={fadeUp}
            className="mt-7 font-display text-[2.6rem] leading-[1.05] font-semibold tracking-tight text-balance text-white sm:text-6xl lg:text-[4.1rem]"
          >
            Sua conta no TikTok Shop, <span className="text-gradient-brand">já aprovada.</span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mx-auto mt-6 max-w-xl text-base text-pretty text-mist sm:text-lg lg:mx-0"
          >
            Pule a fila de análise que recusa a maioria dos pedidos. Escolha uma conta com o Shop ativo, troque nome, @ e
            foto, e comece a afiliar produtos e ganhar comissão hoje.
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start"
          >
            <ButtonLink to="/contas" size="lg" className="w-full sm:w-auto">
              Ver contas disponíveis
              <ArrowRight className="size-4 transition-transform group-hover/btn:translate-x-0.5" />
            </ButtonLink>
            <ButtonLink to="/#como-funciona" variant="secondary" size="lg" className="w-full sm:w-auto">
              Como funciona
            </ButtonLink>
          </motion.div>

          <motion.ul
            variants={fadeUp}
            className="mt-10 flex flex-col items-center gap-3 text-sm text-fog sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-6 lg:justify-start"
          >
            {PROOF_POINTS.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2">
                <Icon aria-hidden className="size-4 text-electric" />
                {label}
              </li>
            ))}
          </motion.ul>
        </motion.div>

        <div className="relative mx-auto">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 40, rotate: -4 }}
            animate={{ opacity: 1, y: 0, rotate: -3 }}
            transition={{ duration: 0.9, delay: 0.15, ease: EASE_OUT_EXPO }}
          >
            <PhoneProfile account={HERO_PREVIEW} />
          </motion.div>

          <FloatingChip
            delay={0.6}
            positionClassName="top-[38%] -left-8 sm:-left-28"
            className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-surface/90 px-3.5 py-2.5 shadow-2xl shadow-black/50 backdrop-blur"
          >
            <VerifiedBadge className="size-7" />
            <div>
              <p className="text-xs font-semibold text-white">Shop ativo</p>
              <p className="text-[0.68rem] text-mist">Sem nova solicitação</p>
            </div>
          </FloatingChip>

          <FloatingChip
            delay={0.8}
            floatOffset={FLOAT_DURATION_S / 2}
            positionClassName="-right-4 -bottom-6 sm:-right-20"
            className="rounded-2xl border border-white/10 bg-surface/90 px-4 py-3 shadow-2xl shadow-black/50 backdrop-blur"
          >
            <p className="text-[0.68rem] text-mist">Pedidos recusados pelo TikTok</p>
            <p className="font-display text-2xl font-bold text-alert">~60%</p>
          </FloatingChip>
        </div>
      </div>
    </section>
  );
}
