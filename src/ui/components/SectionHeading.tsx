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
      <p className="font-display text-[0.7rem] font-semibold tracking-[0.2em] text-electric uppercase sm:text-xs">
        {eyebrow}
      </p>
      <h2
        id={id}
        className="mt-3 font-display text-section font-semibold tracking-tight text-balance text-white md:mt-4 md:text-5xl"
      >
        {title}
      </h2>
      {description && (
        <p className="mt-3 text-[0.95rem] leading-relaxed text-pretty text-mist md:mt-5 md:text-lg">{description}</p>
      )}
    </Reveal>
  );
}
