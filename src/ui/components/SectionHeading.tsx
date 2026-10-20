import type { ReactNode } from "react";
import { cn } from "@/ui/lib/cn";
import { Reveal } from "./Reveal";
import { editable } from "@/ui/lib/site-preview";

interface SectionHeadingProps {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  id?: string;
  /** Seção dos textos do site; na prévia do painel, cada parte vira clicável. */
  editPrefix?: string;
}

export function SectionHeading({ eyebrow, title, description, align = "left", id, editPrefix }: SectionHeadingProps) {
  const edit = (field: string) => (editPrefix ? editable(`${editPrefix}.${field}`) : {});
  return (
    <Reveal className={cn("max-w-2xl", align === "center" && "mx-auto text-center")}>
      <p {...edit("eyebrow")} className="font-display text-[0.7rem] font-semibold tracking-[0.2em] text-electric uppercase sm:text-xs">
        {eyebrow}
      </p>
      <h2
        id={id}
        {...edit("title")}
        className="mt-3 font-display text-section font-semibold tracking-tight text-balance text-white md:mt-4 md:text-5xl"
      >
        {title}
      </h2>
      {description && (
        <p {...edit("description")} className="mt-3 text-[0.95rem] leading-relaxed text-pretty text-mist md:mt-5 md:text-lg">
          {description}
        </p>
      )}
    </Reveal>
  );
}
