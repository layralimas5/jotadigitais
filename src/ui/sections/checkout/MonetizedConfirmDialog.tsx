import { BadgeDollarSign } from "lucide-react";
import type { Account } from "@/domain/account";
import { catalogPathOf } from "@/domain/account-kind";
import { Modal } from "@/ui/admin/components/Modal";
import { Button, ButtonLink } from "@/ui/components/Button";
import { useSiteContent } from "@/ui/hooks/useSiteContent";

interface MonetizedConfirmDialogProps {
  /** Contas monetizadas sem TikTok Shop do pedido; vazio fecha a janela. */
  accounts: readonly Account[];
  onConfirm: () => void;
  onClose: () => void;
}

/** A pedido do Jota: quem leva TikTok monetizada sem Shop confirma que sabe o que está comprando antes do pedido existir. */
export function MonetizedConfirmDialog({ accounts, onConfirm, onClose }: MonetizedConfirmDialogProps) {
  const { monetizedTitle, monetizedNotice, monetizedConfirm, monetizedShopButton } = useSiteContent().checkoutPage;
  return (
    <Modal open={accounts.length > 0} title={monetizedTitle} onClose={onClose} placement="center">
      <div className="flex gap-3 rounded-2xl border border-electric/35 bg-electric/[0.07] p-4">
        <BadgeDollarSign aria-hidden className="mt-0.5 size-5 shrink-0 text-electric" />
        <div className="min-w-0">
          <p className="text-sm leading-relaxed text-fog">{monetizedNotice}</p>
          <p className="mt-3 text-xs text-mist">
            {accounts.length === 1 ? "Conta monetizada, sem TikTok Shop:" : "Contas monetizadas, sem TikTok Shop:"}{" "}
            <span className="font-semibold break-words text-white">{accounts.map((account) => account.handle).join(", ")}</span>
          </p>
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-2">
        <Button type="button" className="w-full" onClick={onConfirm}>
          {monetizedConfirm}
        </Button>
        <ButtonLink to={catalogPathOf("tiktok-shop")} variant="secondary" className="w-full">
          {monetizedShopButton}
        </ButtonLink>
      </div>
    </Modal>
  );
}
