import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { fadeUp, staggerContainer } from "@/ui/lib/motion";

interface RevealProps {
  children: ReactNode;
  className?: string;
  as?: "div" | "ul" | "ol" | "section";
  stagger?: boolean;
}

/** Entrada suave ao rolar a página. Sem transform quando o usuário pede menos movimento. */
export function Reveal({ children, className, as = "div", stagger = false }: RevealProps) {
  const reduceMotion = useReducedMotion();
  const Component = motion[as];
  if (reduceMotion) {
    return <Component className={className}>{children}</Component>;
  }
  return (
    <Component
      className={className}
      variants={stagger ? staggerContainer : fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
    >
      {children}
    </Component>
  );
}

interface RevealItemProps {
  children: ReactNode;
  className?: string;
  as?: "div" | "li";
}

export function RevealItem({ children, className, as = "div" }: RevealItemProps) {
  const reduceMotion = useReducedMotion();
  const Component = motion[as];
  return (
    <Component className={className} variants={reduceMotion ? undefined : fadeUp}>
      {children}
    </Component>
  );
}
