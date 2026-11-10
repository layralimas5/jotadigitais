import { CreditCard, LifeBuoy, MessageCircle, QrCode, ShieldCheck } from "lucide-react";
import type { Ref } from "react";
import { isPurchasable, type Account } from "@/domain/account";
import { formatBRL } from "@/domain/money";
import { MAX_CARD_INSTALLMENTS } from "@/domain/order";
import { ButtonLink, buttonClasses } from "@/ui/components/Button";
import { AddToCartButton } from "@/ui/components/cart/AddToCartButton";
import type { SiteContent } from "@/domain/site-content";
import { useFillTokens, useSiteContent } from "@/ui/hooks/useSiteContent";
import { useStoreSettings } from "@/ui/hooks/useStoreSettings";
import { editable } from "@/ui/lib/site-preview";

type AccountPageCopy = SiteContent["accountPage"];

/** Os três cards da caixa de compra. Garantia e suporte têm um texto para TikTok e outro para as demais redes. */
function perksOf(account: Account, copy: AccountPageCopy) {
  const variant = account.platform === "tiktok" ? "tiktok" : "other";
  return [
    { icon: MessageCircle, ...copy.perkDelivery, path: "accountPage.perkDelivery.text", titlePath: "accountPage.perkDelivery.title" },
    {
      icon: ShieldCheck,
      title: copy.perkGuarantee.title,
      text: copy.perkGuarantee[variant],
      titlePath: "accountPage.perkGuarantee.title",
      path: `accountPage.perkGuarantee.${variant}`,
    },
    {
      icon: LifeBuoy,
      title: copy.perkSupport.title,
      text: copy.perkSupport[variant],
      titlePath: "accountPage.perkSupport.title",
      path: `accountPage.perkSupport.${variant}`,
    },
  ];
}

function Availability({ account }: { account: Account }) {
  const { accountPage } = useSiteContent();
  if (isPurchasable(account)) {
    return (
      <p className="flex items-center gap-2 text-sm text-fog">
        <span aria-hidden className="relative flex size-2">
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70" />
          <span className="relative size-2 rounded-full bg-emerald-400" />
        </span>
        <span {...editable("accountPage.available")}>{accountPage.available}</span>
      </p>
    );
  }
  return (
    <p
      {...editable(account.status === "reserved" ? "accountPage.reserved" : "accountPage.sold")}
      className="rounded-2xl border border-line bg-white/[0.03] p-4 text-center text-sm text-fog"
    >
      {account.status === "reserved" ? accountPage.reserved : accountPage.sold}
    </p>
  );
}

function SupportLink({ account }: { account: Account }) {
  const { whatsappUrl, instagramUrl } = useStoreSettings();
  const { accountPage } = useSiteContent();
  const message = accountPage.questionMessage.replaceAll("{conta}", account.handle);
  const href = whatsappUrl ? `${whatsappUrl}?text=${encodeURIComponent(message)}` : instagramUrl;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={buttonClasses({ variant: "secondary", size: "lg", className: "w-full" })}
    >
      <MessageCircle aria-hidden className="size-4" />
      <span {...editable("accountPage.questionButton")}>{accountPage.questionButton.replaceAll("{canal}", whatsappUrl ? "WhatsApp" : "Instagram")}</span>
    </a>
  );
}

interface AccountBuyBoxProps {
  account: Account;
  ctaRef?: Ref<HTMLDivElement>;
}

export function AccountBuyBox({ account, ctaRef }: AccountBuyBoxProps) {
  const available = isPurchasable(account);
  const { accountPage } = useSiteContent();
  const fill = useFillTokens();
  return (
    <div className="rounded-3xl border border-line bg-surface p-6 md:p-7">
      <p {...editable("accountPage.priceLabel")} className="text-sm text-mist">
        {accountPage.priceLabel}
      </p>
      <p className="mt-1 font-display text-4xl font-bold tracking-tight text-white tabular-nums md:text-5xl">
        {formatBRL(account.price)}
      </p>
      <ul className="mt-3 space-y-1.5 text-sm text-fog">
        <li className="flex items-center gap-2">
          <QrCode aria-hidden className="size-4 text-electric" /> <span {...editable("accountPage.pixLine")}>{accountPage.pixLine}</span>
        </li>
        <li className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <CreditCard aria-hidden className="size-4 text-electric" />
          <span {...editable("accountPage.cardLine")}>{accountPage.cardLine.replaceAll("{parcelas}", String(MAX_CARD_INSTALLMENTS))}</span>
          {accountPage.cardNote && (
            <span {...editable("accountPage.cardNote")} className="text-mist">
              {accountPage.cardNote}
            </span>
          )}
        </li>
      </ul>

      <div className="mt-6">
        <Availability account={account} />
      </div>

      <div ref={ctaRef} className="mt-5 space-y-3">
        {available ? (
          <>
            <ButtonLink to={`/checkout/${account.slug}`} size="lg" className="w-full" {...editable("accountPage.buyButton")}>
              {accountPage.buyButton}
            </ButtonLink>
            <AddToCartButton account={account} labels={{ add: accountPage.cartButton, inCart: accountPage.inCartButton }} />
          </>
        ) : (
          <ButtonLink to="/contas" size="lg" className="w-full" {...editable("accountPage.otherButton")}>
            {accountPage.otherButton}
          </ButtonLink>
        )}
        <SupportLink account={account} />
      </div>

      <ul className="mt-6 space-y-4 border-t border-line pt-6">
        {perksOf(account, accountPage).map(({ icon: Icon, title, text, titlePath, path }) => (
          <li key={titlePath} className="flex gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-electric/10 text-electric">
              <Icon aria-hidden className="size-4" />
            </span>
            <div>
              <p {...editable(titlePath)} className="text-sm font-semibold text-white">
                {fill(title)}
              </p>
              <p {...editable(path)} className="mt-0.5 text-xs leading-relaxed text-mist">
                {fill(text)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
