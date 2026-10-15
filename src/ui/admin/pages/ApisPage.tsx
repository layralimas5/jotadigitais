import { Info, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import type { Platform } from "@/domain/platform";
import { PLATFORM_LABEL } from "@/domain/platform";
import { PlatformGlyph } from "@/ui/components/PlatformGlyph";
import { cn } from "@/ui/lib/cn";
import { PageHeader } from "../components/AdminUi";

type Feasibility = "simple" | "approval";

interface NetworkIntegration {
  platform: Platform;
  feasibility: Feasibility;
  metrics: string;
  requirement: string;
}

/** O que cada rede deixa puxar por API e o que precisa existir antes. Nada aqui está ligado ainda. */
const NETWORKS: readonly NetworkIntegration[] = [
  {
    platform: "youtube",
    feasibility: "simple",
    metrics: "Inscritos, visualizações, número de vídeos e foto do canal.",
    requirement: "Chave da YouTube Data API (Google Cloud). Não precisa do login do canal: os números são públicos.",
  },
  {
    platform: "tiktok",
    feasibility: "approval",
    metrics: "Seguidores, curtidas, número de vídeos e foto do perfil.",
    requirement: "App no TikTok for Developers aprovado e o login de cada conta (OAuth).",
  },
  {
    platform: "instagram",
    feasibility: "approval",
    metrics: "Seguidores, publicações, alcance e foto do perfil.",
    requirement: "Conta profissional ligada a uma Página do Facebook, app da Meta aprovado e o login de cada conta.",
  },
  {
    platform: "facebook",
    feasibility: "approval",
    metrics: "Curtidas e seguidores da página, alcance e foto.",
    requirement: "App da Meta aprovado e acesso de administrador à página (OAuth).",
  },
];

const FEASIBILITY_VIEW: Record<Feasibility, { label: string; className: string }> = {
  simple: { label: "Dá para ligar logo", className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" },
  approval: { label: "Depende de aprovação", className: "border-pink/30 bg-pink/10 text-pink" },
};

function StatusChip({ children, className }: { children: ReactNode; className: string }) {
  return <span className={cn("inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold", className)}>{children}</span>;
}

function SectionTitle({ id, title, description }: { id: string; title: string; description: string }) {
  return (
    <div>
      <h2 id={id} className="font-display text-lg font-semibold text-white">
        {title}
      </h2>
      <p className="mt-1 text-sm text-mist">{description}</p>
    </div>
  );
}

function AiCredits() {
  return (
    <section aria-labelledby="ia-title" className="space-y-4">
      <SectionTitle id="ia-title" title="Inteligência artificial" description="Créditos para a IA trabalhar dentro do sistema." />
      <div className="flex flex-col gap-4 rounded-3xl border border-line bg-surface/60 p-5 sm:flex-row sm:items-center sm:p-6">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet to-pink text-white">
          <Sparkles aria-hidden className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-white">Créditos de IA</p>
            <StatusChip className="border-white/15 bg-white/[0.05] text-mist">Em breve</StatusChip>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-mist">
            Para escrever a descrição das contas, sugerir preço e responder leads. Saldo e consumo aparecem aqui quando o
            plano de IA for ligado.
          </p>
        </div>
      </div>
    </section>
  );
}

function NetworkCard({ network }: { network: NetworkIntegration }) {
  const view = FEASIBILITY_VIEW[network.feasibility];
  return (
    <li className="flex flex-col rounded-3xl border border-line bg-surface/60 p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-semibold text-white">
          <PlatformGlyph platform={network.platform} className="size-4" />
          {PLATFORM_LABEL[network.platform]}
        </p>
        <StatusChip className={view.className}>{view.label}</StatusChip>
      </div>
      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="text-xs text-mist">O que dá para puxar</dt>
          <dd className="mt-0.5 text-fog">{network.metrics}</dd>
        </div>
        <div>
          <dt className="text-xs text-mist">O que precisa</dt>
          <dd className="mt-0.5 text-fog">{network.requirement}</dd>
        </div>
      </dl>
      <button
        type="button"
        disabled
        className="mt-5 h-10 rounded-full border border-line-strong text-sm font-semibold text-mist disabled:cursor-not-allowed"
      >
        Conectar (em breve)
      </button>
    </li>
  );
}

function AccountConnections() {
  return (
    <section aria-labelledby="contas-title" className="space-y-4">
      <SectionTitle
        id="contas-title"
        title="Conectar contas"
        description="Para conferir as métricas das contas do estoque direto da rede, sem copiar à mão."
      />
      <ul className="grid gap-3 md:grid-cols-2">
        {NETWORKS.map((network) => (
          <NetworkCard key={network.platform} network={network} />
        ))}
      </ul>
      <p className="flex gap-2 rounded-2xl border border-line bg-white/[0.02] p-4 text-xs leading-relaxed text-mist">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-electric" />
        Conta conectada com login fica ligada ao sistema. Quando ela for vendida, a conexão precisa ser desfeita antes da
        entrega, para o comprador receber a conta limpa.
      </p>
    </section>
  );
}

export default function ApisPage() {
  return (
    <div className="space-y-10">
      <PageHeader title="APIs" description="Integrações do sistema. Nada está ligado ainda: aqui fica o que cada uma precisa." />
      <AiCredits />
      <AccountConnections />
    </div>
  );
}
