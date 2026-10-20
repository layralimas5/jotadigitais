import { useDocumentMeta } from "@/ui/hooks/useDocumentMeta";
import { useFillTokens, useSiteContent } from "@/ui/hooks/useSiteContent";
import { editable } from "@/ui/lib/site-preview";

export default function TermsPage() {
  const { terms } = useSiteContent();
  const fill = useFillTokens();
  useDocumentMeta(terms.title);
  return (
    <div className="pt-28 pb-24 md:pt-36">
      <article className="mx-auto max-w-3xl px-4 sm:px-6">
        <p {...editable("terms.eyebrow")} className="font-display text-xs font-semibold tracking-[0.2em] text-electric uppercase">
          {terms.eyebrow}
        </p>
        <h1 {...editable("terms.title")} className="mt-4 font-display text-4xl font-semibold tracking-tight text-white md:text-5xl">
          {terms.title}
        </h1>
        <div className="mt-12 space-y-10">
          {terms.sections.map((section, index) => (
            <section key={index}>
              <h2 {...editable(`terms.sections.${index}.title`)} className="font-display text-xl font-semibold text-white">
                {fill(section.title)}
              </h2>
              <p {...editable(`terms.sections.${index}.body`)} className="mt-3 leading-relaxed whitespace-pre-line text-mist">
                {fill(section.body)}
              </p>
            </section>
          ))}
        </div>
      </article>
    </div>
  );
}
