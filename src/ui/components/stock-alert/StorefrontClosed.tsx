import { PackageOpen } from "lucide-react";
import { useSiteContent } from "@/ui/hooks/useSiteContent";
import { editable } from "@/ui/lib/site-preview";
import { cn } from "@/ui/lib/cn";
import { StockAlertButton } from "./StockAlertButton";

/** Vitrine desligada pelo Jota (entre uma remessa e outra): nenhuma conta aparece no site. */
export const useStorefrontClosed = (): boolean => useSiteContent().catalogPage.closed;

/** Aviso que entra no lugar das contas, com o "Me avise" para o cliente deixar o WhatsApp. */
export function StorefrontClosed({ className }: { className?: string }) {
  const { closedTitle, closedMessage } = useSiteContent().catalogPage;
  return (
    <div role="status" className={cn("rounded-3xl border border-line-strong bg-surface/60 p-8 text-center sm:p-12", className)}>
      <PackageOpen aria-hidden className="mx-auto size-9 text-electric" />
      <p {...editable("catalogPage.closedTitle")} className="mt-4 font-display text-xl font-semibold text-white sm:text-2xl">
        {closedTitle}
      </p>
      <p {...editable("catalogPage.closedMessage")} className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-fog sm:text-base">
        {closedMessage}
      </p>
      <StockAlertButton variant="primary" className="mt-6" />
    </div>
  );
}
