import {
  BadgeDollarSign,
  BarChart3,
  Bell,
  Bookmark,
  Grid3x3,
  Heart,
  Lock,
  Menu,
  PlaySquare,
  Search,
  ShoppingBag,
  Store,
} from "lucide-react";
import type { ReactNode } from "react";
import { formatCount, type Account } from "@/domain/account";
import { profileStats } from "@/ui/lib/account-presenter";
import { cn } from "@/ui/lib/cn";
import type { DistributivePick } from "@/shared/types";
import { AccountAvatar, gradientFor } from "./AccountAvatar";

/** Só o que a prévia desenha. O hero usa um perfil inventado, sem preço nem status. */
export type ProfilePreview = DistributivePick<Account, "id" | "platform" | "displayName" | "handle" | "followers" | "stats">;

function Stats({ preview, className, compact = false }: { preview: ProfilePreview; className?: string; compact?: boolean }) {
  return (
    <div className={cn("grid grid-cols-3", compact && "gap-1", className)}>
      {profileStats(preview).map((stat) => (
        <div key={stat.label} className="min-w-0 text-center">
          <p className={cn("font-bold text-zinc-900 tabular-nums", compact ? "text-[0.85rem]" : "text-[0.95rem]")}>{stat.value}</p>
          <p className={cn("truncate text-zinc-500", compact ? "text-[0.52rem]" : "text-[0.62rem]")}>{stat.label}</p>
        </div>
      ))}
    </div>
  );
}

function Pill({ children, accent }: { children: ReactNode; accent?: string }) {
  return (
    <span
      className={cn(
        "flex items-center justify-center gap-1 rounded-md px-3 py-1.5 text-[0.62rem] font-semibold",
        accent ?? "bg-zinc-100 text-zinc-900",
      )}
    >
      {children}
    </span>
  );
}

function FeatureRow({ icon, title, subtitle, iconClassName }: { icon: ReactNode; title: string; subtitle: string; iconClassName: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-zinc-200 p-2.5">
      <span className={cn("grid size-7 place-items-center rounded-lg text-white", iconClassName)}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.62rem] font-bold text-zinc-900">{title}</p>
        <p className="text-[0.55rem] text-emerald-600">{subtitle}</p>
      </div>
    </div>
  );
}

function TikTokBody({ preview }: { preview: Extract<ProfilePreview, { platform: "tiktok" }> }) {
  return (
    <>
      <div className="flex items-center justify-between px-4 pt-6">
        <span className="w-4" />
        <p className="text-[0.8rem] font-bold text-zinc-900">{preview.displayName}</p>
        <Menu className="size-4 text-zinc-900" />
      </div>
      <div className="mt-4 flex flex-col items-center">
        <AccountAvatar account={preview} className="size-20 text-xl ring-4 ring-white" />
        <p className="mt-2 text-[0.7rem] text-zinc-600">{preview.handle}</p>
      </div>
      <Stats preview={preview} className="mt-3 px-6" />
      <div className="mt-3 flex justify-center gap-1.5 px-4">
        <Pill>Editar perfil</Pill>
        <Pill>
          <Store className="size-3" /> Vitrine
        </Pill>
      </div>
      <div className="mt-4 grid grid-cols-4 border-b border-zinc-200 text-zinc-400">
        {[Menu, ShoppingBag, Lock, Bookmark].map((Icon, index) => (
          <span key={index} className={cn("flex justify-center pb-2", index === 1 && "border-b-2 border-zinc-900 text-zinc-900")}>
            <Icon className="size-3.5" />
          </span>
        ))}
      </div>
      <div className="space-y-2 px-3 pt-3 pb-5">
        <FeatureRow
          icon={<ShoppingBag className="size-3.5" />}
          iconClassName="bg-[#fe2c55]"
          title="TikTok Shop para criadores"
          subtitle="Acesso liberado"
        />
        <div className="rounded-xl bg-zinc-50 p-3 text-center">
          <p className="text-[0.66rem] font-bold text-zinc-900">Ganhe com a vitrine</p>
          <p className="mt-0.5 text-[0.55rem] leading-snug text-zinc-500">Adicione produtos e ganhe comissão a cada venda.</p>
          <span className="mt-2 inline-flex items-center gap-1 rounded-md bg-[#fe2c55] px-3 py-1 text-[0.58rem] font-semibold text-white">
            <Heart className="size-2.5" /> Adicionar produtos
          </span>
        </div>
      </div>
    </>
  );
}

function InstagramBody({ preview }: { preview: Extract<ProfilePreview, { platform: "instagram" }> }) {
  return (
    <>
      <div className="flex items-center justify-between px-4 pt-6">
        <p className="text-[0.8rem] font-bold text-zinc-900">{preview.handle.slice(1)}</p>
        <Menu className="size-4 text-zinc-900" />
      </div>
      <div className="mt-4 flex items-center gap-3 px-4">
        <span className="rounded-full bg-gradient-to-tr from-[#feda75] via-[#d62976] to-[#4f5bd5] p-[2px]">
          <AccountAvatar account={preview} className="size-16 text-base ring-2 ring-white" />
        </span>
        <Stats preview={preview} className="min-w-0 flex-1" compact />
      </div>
      <p className="mt-2 px-4 text-[0.68rem] font-semibold text-zinc-900">{preview.displayName}</p>
      <div className="mt-3 grid grid-cols-2 gap-1.5 px-4">
        <Pill>Editar perfil</Pill>
        <Pill>Compartilhar perfil</Pill>
      </div>
      {preview.stats.professional && (
        <div className="mx-4 mt-2 rounded-lg bg-zinc-50 px-3 py-2">
          <p className="flex items-center gap-1 text-[0.6rem] font-bold text-zinc-900">
            <BarChart3 className="size-3" /> Painel profissional
          </p>
          <p className="text-[0.55rem] text-zinc-500">Alcance e visitas ao perfil nos últimos 30 dias</p>
        </div>
      )}
      <div className="mt-3 flex justify-center border-b border-zinc-200 pb-2 text-zinc-900">
        <Grid3x3 className="size-3.5" />
      </div>
      <div className="grid grid-cols-3 gap-0.5 pb-4">
        {Array.from({ length: 9 }, (_, index) => (
          <span
            key={index}
            className={cn("aspect-square bg-gradient-to-br", gradientFor(`${preview.id}-${index}`), index % 2 ? "opacity-70" : "opacity-90")}
          />
        ))}
      </div>
    </>
  );
}

function YouTubeBody({ preview }: { preview: Extract<ProfilePreview, { platform: "youtube" }> }) {
  return (
    <>
      <div className="flex items-center justify-between px-4 pt-6 text-zinc-900">
        <PlaySquare className="size-4 text-[#ff0033]" />
        <span className="flex gap-2">
          <Bell className="size-3.5" />
          <Search className="size-3.5" />
        </span>
      </div>
      <div className={cn("mx-3 mt-3 h-14 rounded-xl bg-gradient-to-br", gradientFor(preview.id))} />
      <div className="mt-3 flex items-center gap-3 px-4">
        <AccountAvatar account={preview} className="size-14 text-base ring-2 ring-white" />
        <div className="min-w-0">
          <p className="truncate text-[0.8rem] font-bold text-zinc-900">{preview.displayName}</p>
          <p className="text-[0.58rem] text-zinc-500">
            {preview.handle} · {formatCount(preview.followers)} inscritos · {formatCount(preview.stats.videos)} vídeos
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-1.5 px-4">
        <Pill>Personalizar canal</Pill>
        <Pill>Gerenciar vídeos</Pill>
      </div>
      <div className="space-y-2 px-3 pt-3 pb-4">
        <FeatureRow
          icon={<BadgeDollarSign className="size-3.5" />}
          iconClassName={preview.stats.monetized ? "bg-[#ff0033]" : "bg-zinc-400"}
          title="Programa de Parcerias"
          subtitle={preview.stats.monetized ? "Monetização ativa" : `${formatCount(preview.stats.watchHours)} horas de exibição`}
        />
        {[0, 1].map((index) => (
          <div key={index} className="flex gap-2">
            <span className={cn("h-10 w-16 shrink-0 rounded-md bg-gradient-to-br", gradientFor(`${preview.id}-v${index}`))} />
            <span className="flex-1 space-y-1 pt-1">
              <span className="block h-1.5 w-full rounded bg-zinc-200" />
              <span className="block h-1.5 w-2/3 rounded bg-zinc-200" />
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function FacebookBody({ preview }: { preview: Extract<ProfilePreview, { platform: "facebook" }> }) {
  return (
    <>
      <div className={cn("mt-3 h-20 bg-gradient-to-br", gradientFor(preview.id))} />
      <div className="-mt-8 px-4">
        <AccountAvatar account={preview} className="size-16 text-base ring-4 ring-white" />
        <p className="mt-1.5 text-[0.85rem] font-bold text-zinc-900">{preview.displayName}</p>
        <p className="text-[0.6rem] text-zinc-500">
          {formatCount(preview.stats.likes)} curtidas · {formatCount(preview.followers)} seguidores
        </p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-1.5 px-4">
        <Pill accent="bg-[#0866ff] text-white">Painel profissional</Pill>
        <Pill>Editar</Pill>
      </div>
      <div className="space-y-2 px-3 pt-3 pb-4">
        <FeatureRow
          icon={<BadgeDollarSign className="size-3.5" />}
          iconClassName={preview.stats.monetized ? "bg-[#0866ff]" : "bg-zinc-400"}
          title={preview.stats.kind === "page" ? "Página" : "Perfil"}
          subtitle={preview.stats.monetized ? "Monetização ativa" : "Pronto para publicar"}
        />
        <div className="rounded-xl bg-zinc-50 p-2.5">
          <span className="block h-1.5 w-3/4 rounded bg-zinc-200" />
          <span className={cn("mt-2 block h-16 rounded-lg bg-gradient-to-br", gradientFor(`${preview.id}-post`))} />
        </div>
      </div>
    </>
  );
}

function ProfileBody({ preview }: { preview: ProfilePreview }) {
  switch (preview.platform) {
    case "tiktok":
      return <TikTokBody preview={preview} />;
    case "instagram":
      return <InstagramBody preview={preview} />;
    case "youtube":
      return <YouTubeBody preview={preview} />;
    case "facebook":
      return <FacebookBody preview={preview} />;
  }
}

/** Ilustração do perfil na rede da conta. É decorativa: os dados reais aparecem no texto da página. */
export function PhoneProfile({ account, className }: { account: ProfilePreview; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative w-[17.5rem] rounded-[2.6rem] border border-white/15 bg-gradient-to-b from-zinc-800 to-zinc-950 p-2.5 shadow-[0_40px_120px_-30px_rgb(39_153_255/0.55)]",
        className,
      )}
    >
      <div className="relative overflow-hidden rounded-[2.1rem] bg-white">
        <div className="absolute top-2 left-1/2 h-5 w-20 -translate-x-1/2 rounded-full bg-black" />
        <div className="flex items-center justify-between px-5 pt-3 text-[0.6rem] font-semibold text-zinc-900">
          <span>9:41</span>
          <span className="tracking-widest">•••</span>
        </div>
        <ProfileBody preview={account} />
      </div>
    </div>
  );
}
