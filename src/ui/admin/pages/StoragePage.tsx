import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Database, FolderOpen, HardDrive, OctagonAlert, Plus, RefreshCw, type LucideIcon } from "lucide-react";
import { loadStorageUsage, type StorageReading } from "@/application/storage-use-cases";
import {
  STORAGE_PROVIDER_LABEL,
  bucketLabelOf,
  formatBytes,
  tableLabelOf,
  usageLevelOf,
  usageShare,
  type BucketUsage,
  type DatabaseUsage,
  type Meter,
  type TableUsage,
  type UsageLevel,
} from "@/domain/storage";
import { Button } from "@/ui/components/Button";
import { ErrorState } from "@/ui/components/StateViews";
import { cn } from "@/ui/lib/cn";
import { EASE_OUT_EXPO } from "@/ui/lib/motion";
import { useViewRole } from "../admin-view";
import { LoadingBlock, PageHeader } from "../components/AdminUi";
import { useAdminQuery } from "../hooks";

/** Quantas tabelas aparecem em "o que mais ocupa": o resto é miúdo. */
const TOP_TABLES = 8;
const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const count = new Intl.NumberFormat("pt-BR");

const LEVEL: Record<UsageLevel, { label: string; icon: LucideIcon; text: string; stroke: string; badge: string }> = {
  ok: { label: "Tranquilo", icon: CheckCircle2, text: "text-emerald-300", stroke: "#34d399", badge: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" },
  warning: { label: "Atenção", icon: AlertTriangle, text: "text-amber-200", stroke: "#fbbf24", badge: "border-amber-300/40 bg-amber-300/10 text-amber-200" },
  critical: { label: "Perto do limite", icon: OctagonAlert, text: "text-[#ff9a9a]", stroke: "#ff3131", badge: "border-alert/40 bg-alert/10 text-[#ff9a9a]" },
};

const RING = 112;
const RING_STROKE = 10;
const RING_RADIUS = (RING - RING_STROKE) / 2;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/** Anel do quanto já foi usado do limite, com a porcentagem no meio. */
function UsageRing({ meter, level }: { meter: Meter; level: UsageLevel }) {
  const reduceMotion = useReducedMotion();
  const share = usageShare(meter);
  // Uso pequeno ainda aparece: um traço mínimo mostra que o anel não está vazio por erro.
  const filled = share === null ? 0 : Math.max(share, 0.015) * RING_LENGTH;
  const percent = share === null ? "—" : `${share < 0.01 && share > 0 ? "<1" : Math.round(share * 100)}%`;
  return (
    <div className="relative shrink-0" style={{ width: RING, height: RING }}>
      <svg width={RING} height={RING} className="-rotate-90" aria-hidden>
        <circle cx={RING / 2} cy={RING / 2} r={RING_RADIUS} fill="none" stroke="currentColor" strokeWidth={RING_STROKE} className="text-white/[0.06]" />
        <motion.circle
          cx={RING / 2}
          cy={RING / 2}
          r={RING_RADIUS}
          fill="none"
          stroke={LEVEL[level].stroke}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          initial={reduceMotion ? false : { strokeDasharray: `0 ${RING_LENGTH}` }}
          animate={{ strokeDasharray: `${filled} ${RING_LENGTH}` }}
          transition={{ duration: 1, ease: EASE_OUT_EXPO }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-display text-xl font-semibold text-white tabular-nums">{percent}</span>
    </div>
  );
}

function MeterCard({ title, icon: Icon, meter, detail }: { title: string; icon: LucideIcon; meter: Meter; detail?: string }) {
  const level = usageLevelOf(meter);
  const { label, icon: LevelIcon, badge } = LEVEL[level];
  const left = meter.limitBytes === null ? null : Math.max(0, meter.limitBytes - meter.usedBytes);
  return (
    <div className="flex items-center gap-5 rounded-2xl border border-line bg-ink/50 p-4 sm:p-5">
      <UsageRing meter={meter} level={level} />
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-medium text-fog">
          <Icon aria-hidden className="size-4 text-mist" /> {title}
        </p>
        <p className="mt-1 font-display text-2xl font-semibold text-white tabular-nums">{formatBytes(meter.usedBytes)}</p>
        <p className="text-xs text-mist">
          {meter.limitBytes === null ? "Sem limite conhecido" : `de ${formatBytes(meter.limitBytes)} · sobram ${formatBytes(left ?? 0)}`}
          {detail && ` · ${detail}`}
        </p>
        <span className={cn("mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold", badge)}>
          <LevelIcon aria-hidden className="size-3.5" /> {label}
        </span>
      </div>
    </div>
  );
}

function SizeBars<T>({ title, items, keyOf, labelOf, bytesOf, noteOf }: {
  title: string;
  items: readonly T[];
  keyOf: (item: T) => string;
  labelOf: (item: T) => string;
  bytesOf: (item: T) => number;
  noteOf: (item: T) => string;
}) {
  const max = Math.max(1, ...items.map(bytesOf));
  return (
    <div>
      <h3 className="text-xs font-semibold tracking-[0.14em] text-mist uppercase">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-mist">Nada por aqui ainda.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((item) => (
            <li key={keyOf(item)}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-fog">{labelOf(item)}</span>
                <span className="shrink-0 font-semibold text-white tabular-nums">{formatBytes(bytesOf(item))}</span>
              </div>
              <div className="mt-1.5 flex items-center gap-3">
                <span aria-hidden className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <span className="block h-full rounded-full bg-electric" style={{ width: `${Math.max(2, (bytesOf(item) / max) * 100)}%` }} />
                </span>
                <span className="w-28 shrink-0 text-right text-xs text-mist tabular-nums">{noteOf(item)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DatabaseCard({ usage }: { usage: DatabaseUsage }) {
  return (
    <section aria-labelledby={`banco-${usage.id}`} className="space-y-5 rounded-3xl border border-line bg-surface/60 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span aria-hidden className="grid size-10 place-items-center rounded-xl bg-electric/10 text-electric">
            <Database className="size-5" />
          </span>
          <div>
            <h2 id={`banco-${usage.id}`} className="font-display text-base font-semibold text-white">
              {usage.name}
            </h2>
            <p className="text-xs text-mist">
              {STORAGE_PROVIDER_LABEL[usage.provider]} · {usage.planLabel}
            </p>
          </div>
        </div>
        <p className="text-xs text-mist">Medido às {time.format(new Date(usage.measuredAt))}</p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <MeterCard title="Banco de dados" icon={HardDrive} meter={usage.database} />
        <MeterCard title="Arquivos (fotos e anexos)" icon={FolderOpen} meter={usage.files} detail={`${count.format(usage.files.count)} arquivos`} />
      </div>

      <div className="grid gap-6 border-t border-line pt-5 lg:grid-cols-2 lg:gap-10">
        <SizeBars<TableUsage>
          title="O que mais ocupa no banco"
          items={usage.tables.slice(0, TOP_TABLES)}
          keyOf={(table) => table.name}
          labelOf={(table) => tableLabelOf(table.name)}
          bytesOf={(table) => table.bytes}
          noteOf={(table) => `≈ ${count.format(table.rows)} ${table.rows === 1 ? "registro" : "registros"}`}
        />
        <SizeBars<BucketUsage>
          title="Pastas de arquivos"
          items={usage.buckets}
          keyOf={(bucket) => bucket.id}
          labelOf={(bucket) => bucketLabelOf(bucket.id)}
          bytesOf={(bucket) => bucket.bytes}
          noteOf={(bucket) => `${count.format(bucket.files)} ${bucket.files === 1 ? "arquivo" : "arquivos"}`}
        />
      </div>
    </section>
  );
}

function FailedDatabase({ reading, onRetry }: { reading: Extract<StorageReading, { status: "error" }>; onRetry: () => void }) {
  return (
    <section className="rounded-3xl border border-line bg-surface/60 p-5 sm:p-6">
      <h2 className="font-display text-base font-semibold text-white">{reading.name}</h2>
      <ErrorState message={`Não deu para ler o uso agora. ${reading.message}`} onRetry={onRetry} />
    </section>
  );
}

/** Lugar reservado para os próximos bancos: cada um que for conectado aparece com o mesmo controle. */
function NextDatabases({ developer }: { developer: boolean }) {
  return (
    <div className="flex items-start gap-3 rounded-3xl border border-dashed border-line-strong p-5 text-sm text-mist sm:p-6">
      <Plus aria-hidden className="mt-0.5 size-4 shrink-0 text-electric" />
      <p>
        <span className="font-medium text-fog">Outros bancos.</span>{" "}
        {developer
          ? "Cada banco novo entra no sistema com o leitor de uso dele e aparece aqui com o mesmo controle, ao lado do Supabase."
          : "Quando o sistema ganhar outro banco, ele aparece aqui com o mesmo controle. Para conectar um, abra um chamado no Suporte."}
      </p>
    </div>
  );
}

/** Aba Armazenamento (admin e desenvolvedora): quanto cada banco ocupa e quanto falta para o limite do plano. */
export default function StoragePage() {
  const role = useViewRole() ?? "admin";
  const readings = useAdminQuery((deps) => loadStorageUsage(deps, role), `storage-usage-${role}`);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Armazenamento"
        description="Quanto o sistema ocupa em cada banco e quanto falta para o limite do plano. Fotos, prints e anexos contam como arquivos."
        action={
          <Button variant="secondary" onClick={readings.reload} disabled={readings.status === "loading"}>
            <RefreshCw aria-hidden className={cn("size-4", readings.status === "loading" && "animate-spin")} /> Atualizar
          </Button>
        }
      />
      {readings.status === "loading" && <LoadingBlock label="Medindo o armazenamento" />}
      {readings.status === "error" && <ErrorState message={readings.error.message} onRetry={readings.reload} />}
      {readings.status === "success" &&
        readings.data.map((reading, index) =>
          reading.status === "ok" ? (
            <DatabaseCard key={reading.usage.id} usage={reading.usage} />
          ) : (
            <FailedDatabase key={`${reading.name}-${index}`} reading={reading} onRetry={readings.reload} />
          ),
        )}
      <NextDatabases developer={role === "developer"} />
    </div>
  );
}
