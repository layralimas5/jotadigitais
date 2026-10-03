import { Bookmark, Heart, Lock, Menu, ShoppingBag, Store } from "lucide-react";
import { formatCount, type TikTokAccount } from "@/domain/account";
import { cn } from "@/ui/lib/cn";
import { AccountAvatar } from "./AccountAvatar";

type ProfilePreview = Pick<TikTokAccount, "id" | "displayName" | "handle" | "followers" | "likes" | "following">;

function ProfileStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <p className="text-[0.95rem] font-bold text-zinc-900 tabular-nums">{formatCount(value)}</p>
      <p className="text-[0.62rem] text-zinc-500">{label}</p>
    </div>
  );
}

/** Ilustração do perfil com a aba do Shop liberada. É decorativa: os dados reais aparecem no texto da página. */
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

        <div className="flex items-center justify-between px-4 pt-6">
          <span className="w-4" />
          <p className="text-[0.8rem] font-bold text-zinc-900">{account.displayName}</p>
          <Menu className="size-4 text-zinc-900" />
        </div>

        <div className="mt-4 flex flex-col items-center">
          <AccountAvatar account={account} className="size-20 text-xl ring-4 ring-white" />
          <p className="mt-2 text-[0.7rem] text-zinc-600">{account.handle}</p>
        </div>

        <div className="mt-3 grid grid-cols-3 px-6">
          <ProfileStat value={account.following} label="Seguindo" />
          <ProfileStat value={account.followers} label="Seguidores" />
          <ProfileStat value={account.likes} label="Curtidas" />
        </div>

        <div className="mt-3 flex justify-center gap-1.5 px-4">
          <span className="rounded-md bg-zinc-100 px-3 py-1.5 text-[0.62rem] font-semibold text-zinc-900">
            Editar perfil
          </span>
          <span className="flex items-center gap-1 rounded-md bg-zinc-100 px-3 py-1.5 text-[0.62rem] font-semibold text-zinc-900">
            <Store className="size-3" /> Vitrine
          </span>
        </div>

        <div className="mt-4 grid grid-cols-4 border-b border-zinc-200 text-zinc-400">
          {[Menu, ShoppingBag, Lock, Bookmark].map((Icon, index) => (
            <span
              key={index}
              className={cn(
                "flex justify-center pb-2",
                index === 1 && "border-b-2 border-zinc-900 text-zinc-900",
              )}
            >
              <Icon className="size-3.5" />
            </span>
          ))}
        </div>

        <div className="space-y-2 px-3 pt-3 pb-5">
          <div className="flex items-center gap-2 rounded-xl border border-zinc-200 p-2.5">
            <span className="grid size-7 place-items-center rounded-lg bg-[#fe2c55] text-white">
              <ShoppingBag className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.62rem] font-bold text-zinc-900">TikTok Shop para criadores</p>
              <p className="text-[0.55rem] text-emerald-600">Acesso liberado</p>
            </div>
          </div>
          <div className="rounded-xl bg-zinc-50 p-3 text-center">
            <p className="text-[0.66rem] font-bold text-zinc-900">Ganhe com a vitrine</p>
            <p className="mt-0.5 text-[0.55rem] leading-snug text-zinc-500">
              Adicione produtos e ganhe comissão a cada venda.
            </p>
            <span className="mt-2 inline-flex items-center gap-1 rounded-md bg-[#fe2c55] px-3 py-1 text-[0.58rem] font-semibold text-white">
              <Heart className="size-2.5" /> Adicionar produtos
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
