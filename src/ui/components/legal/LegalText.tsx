import { Link } from "react-router-dom";
import { parseInline, type LegalTokenValues } from "@/domain/legal/legal-document";

const linkClass = "text-electric-soft underline underline-offset-4 hover:text-white";

/** Campo que o controlador precisa preencher antes de publicar: fica bem visível de propósito. */
export function MissingField({ label }: { label: string }) {
  return (
    <mark className="rounded-md bg-amber-300/15 px-1.5 py-0.5 font-medium text-amber-200 ring-1 ring-amber-300/30 ring-inset">
      [preencher: {label}]
    </mark>
  );
}

export function LegalText({ text, tokens }: { text: string; tokens: LegalTokenValues }) {
  return (
    <>
      {parseInline(text, tokens).map((part, index) => {
        if (part.kind === "text") return <span key={index}>{part.value}</span>;
        if (part.kind === "missing") return <MissingField key={index} label={part.label} />;
        return part.href.startsWith("/") ? (
          <Link key={index} to={part.href} className={linkClass}>
            {part.label}
          </Link>
        ) : (
          <a key={index} href={part.href} target="_blank" rel="noreferrer" className={linkClass}>
            {part.label}
            <span className="sr-only"> (abre em outra aba)</span>
          </a>
        );
      })}
    </>
  );
}
