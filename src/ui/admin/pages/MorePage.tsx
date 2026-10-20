import { ChevronRight, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/AdminUi";
import { MORE_ITEMS } from "../navigation";

const rowClass =
  "flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-white/[0.03] active:bg-white/[0.05] focus-visible:bg-white/[0.05] focus-visible:outline-none";

function Row({ icon, title, description, trailing }: { icon: ReactNode; title: string; description: string; trailing: ReactNode }) {
  return (
    <>
      <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-line-strong bg-ink text-electric">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-white">{title}</span>
        <span className="block truncate text-xs text-mist">{description}</span>
      </span>
      {trailing}
    </>
  );
}

/** No celular, as seções que não cabem na barra de baixo. */
export default function MorePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Mais" />
      <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface/60">
        {MORE_ITEMS.map(({ to, label, icon: Icon, description }) => (
          <li key={to}>
            <Link to={to} className={rowClass}>
              <Row
                icon={<Icon aria-hidden className="size-5" />}
                title={label}
                description={description}
                trailing={<ChevronRight aria-hidden className="size-4 text-mist" />}
              />
            </Link>
          </li>
        ))}
      </ul>
      <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface/60">
        <li>
          <a href="/" target="_blank" rel="noreferrer" className={rowClass}>
            <Row
              icon={<ExternalLink aria-hidden className="size-5" />}
              title="Ver site"
              description="Abre a loja em outra aba"
              trailing={<ExternalLink aria-hidden className="size-4 text-mist" />}
            />
          </a>
        </li>
      </ul>
    </div>
  );
}
