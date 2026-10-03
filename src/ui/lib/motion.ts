import type { Transition, Variants } from "framer-motion";

export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

export const revealTransition: Transition = { duration: 0.6, ease: EASE_OUT_EXPO };

export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: revealTransition },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: revealTransition },
};
