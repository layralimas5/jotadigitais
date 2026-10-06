import { Check } from "lucide-react";
import type { ReactNode } from "react";
import {
  FULL_SHOP_MIN_FOLLOWERS,
  followersToFullShop,
  shopTierOf,
  type TikTokAccount,
} from "@/domain/account";
import { STEPS } from "@/ui/sections/home/HowItWorks";

const INCLUDED = [
  "Central de Criadores do TikTok Shop ativa",
  "Seguidores reais e brasileiros",
  "Sem documentos vinculados",
  "Troca livre de nome, @ e foto",
  "Login e senha entregues por e-mail",
] as const;

const number = new Intl.NumberFormat("pt-BR");
const ratio = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const date = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });

function shopStatus(account: TikTokAccount): string {
  if (shopTierOf(account) === "full") return "Ativo, com todos os produtos liberados";
  return `Piloto (completo a partir de ${number.format(FULL_SHOP_MIN_FOLLOWERS)} seguidores, faltam ${number.format(followersToFullShop(account))})`;
}

function specsOf(account: TikTokAccount): { label: string; value: string }[] {
  return [
    { label: "Nicho atual", value: account.niche },
    { label: "Seguidores", value: number.format(account.followers) },
    { label: "Curtidas", value: number.format(account.likes) },
    { label: "Seguindo", value: number.format(account.following) },
    { label: "Curtidas por seguidor", value: ratio.format(account.likes / Math.max(account.followers, 1)) },
    { label: "TikTok Shop", value: shopStatus(account) },
    { label: "Central de Criadores", value: "Ativa" },
    { label: "Origem dos seguidores", value: "Brasil" },
    { label: "Documentos vinculados", value: "Nenhum" },
    { label: "Troca de nome, @ e foto", value: "Liberada" },
    { label: "Anunciada em", value: date.format(new Date(account.listedAt)) },
  ];
}

function DetailBlock({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="font-display text-xl font-semibold text-white md:text-2xl">
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function AccountDescription({ account }: { account: TikTokAccount }) {
  const pilot = shopTierOf(account) === "pilot";
  return (
    <DetailBlock id="sobre-title" title="Sobre esta conta">
      <div className="space-y-4 text-base leading-relaxed text-fog">
        <p>
          Conta de {account.niche.toLowerCase()} com {number.format(account.followers)} seguidores reais e brasileiros e{" "}
          {number.format(account.likes)} curtidas. A Central de Criadores do TikTok Shop já está ativa: depois da compra
          você troca nome, @ e foto e começa a afiliar produtos na vitrine.
        </p>
        <p>
          {pilot
            ? `O Shop está em modo piloto, como em toda conta com menos de ${number.format(FULL_SHOP_MIN_FOLLOWERS)} seguidores. Funciona normalmente; alguns produtos liberam conforme a conta cresce.`
            : "A conta já passou do modo piloto: todos os produtos do TikTok Shop estão disponíveis para afiliação."}
        </p>
        <p className="text-mist">
          O nicho é só o conteúdo de hoje. Você pode mudar o tipo de vídeo e vender produtos de qualquer categoria.
        </p>
      </div>
    </DetailBlock>
  );
}

export function AccountSpecs({ account }: { account: TikTokAccount }) {
  return (
    <DetailBlock id="ficha-title" title="Ficha técnica">
      <dl className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface/60">
        {specsOf(account).map(({ label, value }) => (
          <div key={label} className="grid gap-1 px-5 py-3.5 sm:grid-cols-[13rem_1fr] sm:gap-4">
            <dt className="text-sm text-mist">{label}</dt>
            <dd className="text-sm font-medium text-white tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </DetailBlock>
  );
}

export function AccountIncluded() {
  return (
    <DetailBlock id="incluso-title" title="O que está incluso">
      <ul className="space-y-3">
        {INCLUDED.map((item) => (
          <li key={item} className="flex items-center gap-3 text-sm text-fog">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-electric/15 text-electric">
              <Check aria-hidden className="size-3" strokeWidth={3} />
            </span>
            {item}
          </li>
        ))}
      </ul>
    </DetailBlock>
  );
}

export function AccountDelivery() {
  return (
    <DetailBlock id="entrega-title" title="Como você recebe">
      <ol className="space-y-5">
        {STEPS.map(({ icon: Icon, title, text }, index) => (
          <li key={title} className="relative flex gap-4">
            {index < STEPS.length - 1 && (
              <span aria-hidden className="absolute top-11 bottom-[-1.25rem] left-[1.15rem] w-px bg-line" />
            )}
            <span className="relative grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-ink text-electric">
              <Icon aria-hidden className="size-4" />
            </span>
            <div className="pt-1">
              <p className="text-sm font-semibold text-white">
                <span className="text-mist">0{index + 1}.</span> {title}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-mist">{text}</p>
            </div>
          </li>
        ))}
      </ol>
    </DetailBlock>
  );
}
