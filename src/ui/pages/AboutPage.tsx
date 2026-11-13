import { BadgeCheck, Headset, ShieldCheck, Sparkles, Star, UserRound } from "lucide-react";
import type { SiteImage } from "@/domain/site-content";
import { PageButtons } from "@/ui/components/PageButtons";
import { Reveal, RevealItem } from "@/ui/components/Reveal";
import { useDocumentMeta } from "@/ui/hooks/useDocumentMeta";
import { useFillTokens, useSiteContent } from "@/ui/hooks/useSiteContent";
import { cn } from "@/ui/lib/cn";
import { editable } from "@/ui/lib/site-preview";

/** Ícone de cada destaque, na ordem; depois do sexto, recomeça. */
const HIGHLIGHT_ICONS = [BadgeCheck, Headset, ShieldCheck, Star, Sparkles, UserRound] as const;

const paragraphsOf = (text: string) =>
  text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

/** Duas ou quatro: duas colunas; o resto, três. */
const columns = (count: number) => (count === 1 ? "" : count === 2 || count === 4 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3");

function Portrait({ photo }: { photo: SiteImage }) {
  return (
    <div {...editable("aboutPage.photo.url")} className="relative mx-auto w-full max-w-sm lg:max-w-none">
      <div aria-hidden className="absolute -inset-y-6 inset-x-0 rounded-[2.5rem] bg-violet/25 blur-3xl sm:-inset-6" />
      <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] border border-line-strong bg-surface">
        {photo.url ? (
          <img src={photo.url} alt={photo.alt} className="size-full object-cover" fetchPriority="high" />
        ) : (
          <div role="img" aria-label={photo.alt} className="grid size-full place-items-center bg-grid">
            <UserRound aria-hidden className="size-20 text-electric/60" />
          </div>
        )}
      </div>
    </div>
  );
}

function Story() {
  const { aboutPage } = useSiteContent();
  const fill = useFillTokens();
  return (
    <Reveal as="section" aria-labelledby="sobre-historia" className="mx-auto mt-20 max-w-3xl sm:mt-28">
      <h2 id="sobre-historia" {...editable("aboutPage.storyTitle")} className="font-display text-section font-semibold tracking-tight text-white md:text-4xl">
        {aboutPage.storyTitle}
      </h2>
      <div {...editable("aboutPage.story")} className="mt-6 space-y-5 text-lg leading-relaxed text-pretty text-fog">
        {paragraphsOf(fill(aboutPage.story)).map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
    </Reveal>
  );
}

function Highlights() {
  const { aboutPage } = useSiteContent();
  const fill = useFillTokens();
  if (aboutPage.highlights.length === 0) return null;
  return (
    <section aria-labelledby="sobre-destaques" className="mt-20 sm:mt-28">
      <Reveal>
        <h2 id="sobre-destaques" {...editable("aboutPage.highlightsTitle")} className="font-display text-section font-semibold tracking-tight text-white md:text-4xl">
          {aboutPage.highlightsTitle}
        </h2>
      </Reveal>
      <Reveal as="ul" stagger className={cn("mt-8 grid gap-3 sm:gap-5", columns(aboutPage.highlights.length))}>
        {aboutPage.highlights.map((highlight, index) => {
          const Icon = HIGHLIGHT_ICONS[index % HIGHLIGHT_ICONS.length] ?? Star;
          return (
            <RevealItem as="li" key={index}>
              <div className="hover-pulse h-full rounded-2xl border border-line bg-surface/70 p-5 sm:rounded-3xl sm:p-6">
                <span className="pulse-icon grid size-11 place-items-center rounded-xl border border-white/10 bg-ink text-electric sm:size-12">
                  <Icon aria-hidden className="size-5" />
                </span>
                <h3 {...editable(`aboutPage.highlights.${index}.title`)} className="mt-5 font-display text-lg font-semibold text-white">
                  {highlight.title}
                </h3>
                <p {...editable(`aboutPage.highlights.${index}.text`)} className="mt-2 text-sm leading-relaxed text-mist">
                  {fill(highlight.text)}
                </p>
              </div>
            </RevealItem>
          );
        })}
      </Reveal>
    </section>
  );
}

function Gallery() {
  const { aboutPage } = useSiteContent();
  // Na prévia, a foto recém-adicionada ainda não tem imagem: só entra quando for enviada.
  const photos = aboutPage.gallery.map((photo, index) => ({ photo, index })).filter(({ photo }) => photo.url);
  if (photos.length === 0) return null;
  return (
    <section aria-label="Fotos" className="mt-20 sm:mt-28">
      <Reveal as="ul" stagger className={cn("grid grid-cols-2 gap-3 sm:gap-5", photos.length >= 3 && "lg:grid-cols-3")}>
        {photos.map(({ photo, index }) => (
          <RevealItem as="li" key={index}>
            <div {...editable(`aboutPage.gallery.${index}.url`)} className="aspect-square overflow-hidden rounded-2xl border border-line bg-surface sm:rounded-3xl">
              <img src={photo.url} alt={photo.alt} loading="lazy" decoding="async" className="size-full object-cover transition-transform duration-500 hover:scale-[1.03]" />
            </div>
          </RevealItem>
        ))}
      </Reveal>
    </section>
  );
}

export default function AboutPage() {
  const { aboutPage } = useSiteContent();
  const fill = useFillTokens();
  useDocumentMeta(aboutPage.eyebrow, fill(aboutPage.description));

  return (
    <div className="pt-28 pb-14 sm:pb-20 md:pt-36 md:pb-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16">
          <Reveal>
            <p {...editable("aboutPage.eyebrow")} className="font-display text-xs font-semibold tracking-[0.2em] text-electric uppercase">
              {aboutPage.eyebrow}
            </p>
            <h1 id="sobre-title" {...editable("aboutPage.title")} className="mt-4 font-display text-4xl font-semibold tracking-tight text-balance text-white md:text-6xl">
              {aboutPage.title}
            </h1>
            <p {...editable("aboutPage.description")} className="mt-4 text-lg leading-relaxed text-pretty text-fog md:mt-6">
              {fill(aboutPage.description)}
            </p>
            <PageButtons buttons={aboutPage.buttons} path="aboutPage.buttons" className="mt-7 sm:mt-9" />
          </Reveal>
          <Reveal>
            <Portrait photo={aboutPage.photo} />
          </Reveal>
        </div>

        <Story />
        <Highlights />
        <Gallery />

        <Reveal className="mt-20 border-t border-line pt-10 sm:mt-28 sm:pt-14">
          <PageButtons buttons={aboutPage.buttons.slice(0, 1)} path="aboutPage.buttons" centered />
        </Reveal>
      </div>
    </div>
  );
}
