import type { ReactNode } from "react";
import { cn } from "@/ui/lib/cn";
import { Reveal } from "./Reveal";

interface SectionHeadingProps {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  id?: string;
}

export function SectionHeading({ eyebrow, title, description, align = "left", id }: SectionHeadingProps) {
  return (
    <Reveal className={cn("max-w-2xl", align === "center" && "mx-auto text-center")}>
      <p className="font-display text-xs font-semibold tracking-[0.2em] text-electric uppercase">{eyebrow}</p>
      <h2
        id={id}
        className="mt-4 font-display text-3xl font-semibold tracking-tight text-balance text-white md:text-5xl"
      >
        {title}
      </h2>
      {description && <p className="mt-5 text-base text-pretty text-mist md:text-lg">{description}</p>}
    </Reveal>
  );
}
