import { Check, X } from "lucide-react";
import { Reveal, RevealItem } from "@/ui/components/Reveal";
import { SectionHeading } from "@/ui/components/SectionHeading";
import { VerifiedBadge } from "@/ui/components/VerifiedBadge";
import { useSiteContent } from "@/ui/hooks/useSiteContent";
import { cn } from "@/ui/lib/cn";

type Tone = "alert" | "electric";

interface Screenshot {
  src: string;
  alt: string;
  tone: Tone;
  fadeClassName: string;
}

/** Print real do app, recortado no topo com um esmaecido embaixo para parecer cortado. */
function ScreenshotCrop({ shot, className }: { shot: Screenshot; className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border shadow-2xl shadow-black/50",
        shot.tone === "alert" ? "border-alert/30" : "border-electric/30",
        className,
      )}
    >
      <img
        src={shot.src}
        alt={shot.alt}
        loading="lazy"
        decoding="async"
        className="size-full object-cover object-top"
      />
      <div
        aria-hidden
        className={cn("absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t md:h-16 to-transparent", shot.fadeClassName)}
      />
    </div>
  );
}

const toneIcon: Record<Tone, { icon: typeof X; className: string }> = {
  alert: { icon: X, className: "bg-alert/15 text-alert" },
  electric: { icon: Check, className: "bg-electric/15 text-electric" },
};

function ToneMark({ tone }: { tone: Tone }) {
  const { icon: Icon, className } = toneIcon[tone];
  return (
    <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full", className)}>
      <Icon aria-hidden className="size-3" strokeWidth={3} />
    </span>
  );
}

function ChecklistItems({ items, tone }: { items: readonly string[]; tone: Tone }) {
  return (
    <ul className="mt-4 space-y-2.5 md:mt-7 md:space-y-3.5">
      {items.map((item, index) => (
        <li key={index} className="flex gap-3 text-sm text-fog">
          <ToneMark tone={tone} />
          {item}
        </li>
      ))}
    </ul>
  );
}

/** Cada print fica dentro do card que ele ilustra, em qualquer tela. */
const shotClassName = "mx-auto mt-4 aspect-[9/7] w-full max-w-[15rem] md:mt-6 md:max-w-[17rem]";

export function ProblemSection() {
  const { problem } = useSiteContent();
  const rejected: Screenshot = { src: problem.fromScratchImage.url, alt: problem.fromScratchImage.alt, tone: "alert", fadeClassName: "from-white" };
  const approved: Screenshot = { src: problem.withUsImage.url, alt: problem.withUsImage.alt, tone: "electric", fadeClassName: "from-[#121212]" };
  return (
    <section aria-labelledby="problema-title" className="relative py-14 sm:py-20 md:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          id="problema-title"
          eyebrow={problem.eyebrow}
          title={
            <>
              {problem.title}
              {problem.titleMuted && (
                <>
                  {" "}
                  <span className="text-mist">{problem.titleMuted}</span>
                </>
              )}
            </>
          }
          description={problem.description}
        />

        <Reveal stagger className="mt-8 grid gap-3 md:mt-14 md:grid-cols-2 md:gap-5">
          <RevealItem className="rounded-3xl border border-line bg-surface/60 p-5 md:p-9">
            <p className="text-sm font-semibold text-mist">{problem.fromScratchTitle}</p>
            <ScreenshotCrop shot={rejected} className={shotClassName} />
            <ChecklistItems items={problem.fromScratch} tone="alert" />
          </RevealItem>

          <RevealItem className="relative rounded-3xl bg-gradient-brand p-px">
            <div className="h-full rounded-[calc(1.5rem-1px)] bg-surface p-5 md:p-9">
              <p className="flex items-center gap-2 text-sm font-semibold text-white">
                <VerifiedBadge className="size-5" /> {problem.withUsTitle}
              </p>
              <ScreenshotCrop shot={approved} className={shotClassName} />
              <ChecklistItems items={problem.withUs} tone="electric" />
            </div>
          </RevealItem>
        </Reveal>
      </div>
    </section>
  );
}
