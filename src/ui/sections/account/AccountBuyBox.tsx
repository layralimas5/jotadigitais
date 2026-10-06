import { CreditCard, LifeBuoy, Mail, MessageCircle, QrCode, ShieldCheck } from "lucide-react";
import type { Ref } from "react";
import { siteConfig } from "@/app/config";
import { isPurchasable, type TikTokAccount } from "@/domain/account";
import { formatBRL } from "@/domain/money";
import { MAX_CARD_INSTALLMENTS } from "@/domain/order";
import { ButtonLink, buttonClasses } from "@/ui/components/Button";

const PERKS = [
  {
    icon: Mail,
    title: "Entrega por e-mail",
    text: "Login, senha e passo a passo logo após a confirmação do pagamento.",
  },
  {
    icon: ShieldCheck,
    title: `${siteConfig.guaranteeDays} dias de garantia`,
    text: "Shop inativo na entrega? Você recebe outra conta ou o dinheiro de volta.",
  },
  {
    icon: LifeBuoy,
    title: "Suporte na troca",
    text: "Ajudamos a trocar nome, @, foto e a fazer a primeira afiliação.",
  },
] as const;

function Availability({ account }: { account: TikTokAccount }) {
  if (isPurchasable(account)) {
    return (
      <p className="flex items-center gap-2 text-sm text-fog">
        <span aria-hidden className="relative flex size-2">
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70" />
          <span className="relative size-2 rounded-full bg-emerald-400" />
        </span>
        Disponível. Unidade única: quando alguém compra, ela sai da vitrine.
      </p>
    );
  }
  return (
    <p className="rounded-2xl border border-line bg-white/[0.03] p-4 text-center text-sm text-fog">
      {account.status === "reserved" ? "Esta conta está reservada por outro cliente." : "Esta conta já foi vendida."}
    </p>
  );
}

function SupportLink({ account }: { account: TikTokAccount }) {
  const href = siteConfig.whatsappUrl
    ? `${siteConfig.whatsappUrl}?text=${encodeURIComponent(`Olá! Tenho uma dúvida sobre a conta ${account.handle}.`)}`
    : siteConfig.instagramUrl;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={buttonClasses({ variant: "secondary", size: "lg", className: "w-full" })}
    >
      <MessageCircle aria-hidden className="size-4" />
      Tirar dúvida {siteConfig.whatsappUrl ? "no WhatsApp" : "no Instagram"}
    </a>
  );
}

interface AccountBuyBoxProps {
  account: TikTokAccount;
  ctaRef?: Ref<HTMLDivElement>;
}

export function AccountBuyBox({ account, ctaRef }: AccountBuyBoxProps) {
  const available = isPurchasable(account);
  return (
    <div className="rounded-3xl border border-line bg-surface p-6 md:p-7">
      <p className="text-sm text-mist">Valor da conta</p>
      <p className="mt-1 font-display text-4xl font-bold tracking-tight text-white tabular-nums md:text-5xl">
        {formatBRL(account.price)}
      </p>
      <ul className="mt-3 space-y-1.5 text-sm text-fog">
        <li className="flex items-center gap-2">
          <QrCode aria-hidden className="size-4 text-electric" /> À vista no Pix
        </li>
        <li className="flex items-center gap-2">
          <CreditCard aria-hidden className="size-4 text-electric" /> Ou em até {MAX_CARD_INSTALLMENTS}x no cartão
          <span className="text-mist">(juros da operadora)</span>
        </li>
      </ul>

      <div className="mt-6">
        <Availability account={account} />
      </div>

      <div ref={ctaRef} className="mt-5 space-y-3">
        {available ? (
          <ButtonLink to={`/checkout/${account.slug}`} size="lg" className="w-full">
            Comprar esta conta
          </ButtonLink>
        ) : (
          <ButtonLink to="/contas" size="lg" className="w-full">
            Ver outras contas
          </ButtonLink>
        )}
        <SupportLink account={account} />
      </div>

      <ul className="mt-6 space-y-4 border-t border-line pt-6">
        {PERKS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-electric/10 text-electric">
              <Icon aria-hidden className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-white">{title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-mist">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
