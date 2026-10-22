import { Link } from "react-router-dom";
import { LEGAL_DOCUMENTS } from "@/application/legal-documents";
import { LEGAL_DOCUMENT_PATH, type LegalBlock, type LegalDocumentSlug, type LegalTokenValues } from "@/domain/legal/legal-document";
import { LegalText } from "@/ui/components/legal/LegalText";
import { PendingControllerNotice } from "@/ui/components/legal/PendingControllerNotice";
import { useDocumentMeta } from "@/ui/hooks/useDocumentMeta";
import { useLegalTokens } from "@/ui/hooks/useLegalTokens";

const formatDay = (isoDate: string) =>
  new Date(`${isoDate}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

const OTHER: Record<LegalDocumentSlug, LegalDocumentSlug> = { terms: "privacy", privacy: "terms" };

function Block({ block, tokens }: { block: LegalBlock; tokens: LegalTokenValues }) {
  switch (block.type) {
    case "p":
      return (
        <p className="leading-relaxed text-mist">
          <LegalText text={block.text} tokens={tokens} />
        </p>
      );
    case "note":
      return (
        <p className="rounded-2xl border border-line-strong bg-surface/70 p-4 text-sm leading-relaxed text-fog">
          <LegalText text={block.text} tokens={tokens} />
        </p>
      );
    case "list":
      return (
        <ul className="list-disc space-y-2 pl-5 leading-relaxed text-mist marker:text-electric">
          {block.items.map((item, index) => (
            <li key={index}>
              <LegalText text={item} tokens={tokens} />
            </li>
          ))}
        </ul>
      );
    case "defs":
      return (
        <dl className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
          {block.items.map((item, index) => (
            <div key={index} className="grid gap-1 p-4 sm:grid-cols-[minmax(0,14rem)_1fr] sm:gap-6">
              <dt className="font-semibold text-white">{item.term}</dt>
              <dd className="leading-relaxed text-mist">
                <LegalText text={item.text} tokens={tokens} />
              </dd>
            </div>
          ))}
        </dl>
      );
  }
}

export default function LegalDocumentPage({ slug }: { slug: LegalDocumentSlug }) {
  const document = LEGAL_DOCUMENTS[slug];
  const other = LEGAL_DOCUMENTS[OTHER[slug]];
  const tokens = useLegalTokens();
  useDocumentMeta(document.title, document.summary.replace(/\{\{\w+\}\}/g, "Jota Digitais").slice(0, 160));

  return (
    <div className="pt-28 pb-24 md:pt-36">
      <article className="mx-auto max-w-3xl px-4 sm:px-6">
        <p className="font-display text-xs font-semibold tracking-[0.2em] text-electric uppercase">Documento legal</p>
        <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight text-white md:text-5xl">{document.title}</h1>
        <p className="mt-3 text-sm text-mist">
          Versão {document.version} · vigente desde <time dateTime={document.effectiveDate}>{formatDay(document.effectiveDate)}</time>
        </p>

        <div className="mt-8">
          <PendingControllerNotice />
        </div>

        <p className="mt-8 text-lg leading-relaxed text-fog">
          <LegalText text={document.summary} tokens={tokens} />
        </p>

        <nav aria-labelledby="sumario" className="mt-10 rounded-3xl border border-line bg-surface/60 p-5 sm:p-6">
          <h2 id="sumario" className="font-display text-sm font-semibold text-white">
            Nesta página
          </h2>
          <ol className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {document.sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="text-mist transition-colors hover:text-white">
                  <LegalText text={section.title} tokens={tokens} />
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-12 space-y-12">
          {document.sections.map((section) => (
            <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-24">
              <h2 id={`${section.id}-title`} className="font-display text-xl font-semibold text-white md:text-2xl">
                <LegalText text={section.title} tokens={tokens} />
              </h2>
              <div className="mt-4 space-y-4">
                {section.blocks.map((block, index) => (
                  <Block key={index} block={block} tokens={tokens} />
                ))}
              </div>
            </section>
          ))}
        </div>

        <section aria-labelledby="historico" className="mt-14 border-t border-line pt-8">
          <h2 id="historico" className="font-display text-base font-semibold text-white">
            Histórico de versões
          </h2>
          <ol className="mt-4 space-y-2 text-sm text-mist">
            {document.history.map((entry) => (
              <li key={entry.version}>
                <span className="font-semibold text-fog">{entry.version}</span> ·{" "}
                <time dateTime={entry.date}>{formatDay(entry.date)}</time> · {entry.summary}
              </li>
            ))}
          </ol>
          <p className="mt-8 text-sm text-mist">
            Veja também a{" "}
            <Link to={LEGAL_DOCUMENT_PATH[other.slug]} className="text-electric-soft underline underline-offset-4 hover:text-white">
              {other.title}
            </Link>{" "}
            e a página{" "}
            <Link to="/meus-dados" className="text-electric-soft underline underline-offset-4 hover:text-white">
              Meus dados
            </Link>
            .
          </p>
        </section>
      </article>
    </div>
  );
}
