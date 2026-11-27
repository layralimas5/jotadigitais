import { HelpCircle } from "lucide-react";
import { useState } from "react";
import { Modal } from "@/ui/admin/components/Modal";
import { Button } from "@/ui/components/Button";
import { useSiteContent } from "@/ui/hooks/useSiteContent";
import { cn } from "@/ui/lib/cn";
import { IS_SITE_PREVIEW, editable } from "@/ui/lib/site-preview";

const SEEN_KEY = "jota:kinds-guide-seen";

function wasSeen(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    // Navegador sem localStorage (aba anônima restrita): mostra o card, que é o caminho seguro.
    return false;
  }
}

function markSeen(): void {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Sem localStorage o card volta na próxima visita; nada a fazer.
  }
}

/**
 * Card do Suporte (chamado da conta monetizada): explica cada tipo de conta de TikTok.
 * Abre sozinho na primeira visita à vitrine e depois pelo botão. Na prévia da aba Site, só pelo botão.
 */
export function AccountKindsGuide({ className }: { className?: string }) {
  const copy = useSiteContent().catalogPage;
  const [open, setOpen] = useState(() => !IS_SITE_PREVIEW && !wasSeen());
  const close = () => {
    markSeen();
    setOpen(false);
  };
  const kinds = [
    { label: "TikTok Shop ativo", text: copy.guideFull, path: "catalogPage.guideFull" },
    { label: "TikTok Shop piloto", text: copy.guidePilot, path: "catalogPage.guidePilot" },
    { label: "Monetizada", text: copy.guideMonetized, path: "catalogPage.guideMonetized" },
    { label: "Sem TikTok Shop", text: copy.guideNone, path: "catalogPage.guideNone" },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-1.5 text-sm font-medium text-electric underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-electric",
          className,
        )}
      >
        <HelpCircle aria-hidden className="size-4" />
        <span {...editable("catalogPage.guideButton")}>{copy.guideButton}</span>
      </button>
      <Modal open={open} title={copy.guideTitle} description={copy.guideIntro} onClose={close} placement="center">
        <dl className="space-y-3">
          {kinds.map((kind) => (
            <div key={kind.label} className="rounded-2xl border border-line-strong bg-white/[0.03] p-4">
              <dt className="text-sm font-semibold text-white">{kind.label}</dt>
              <dd {...editable(kind.path)} className="mt-1 text-sm leading-relaxed text-fog">
                {kind.text}
              </dd>
            </div>
          ))}
        </dl>
        <Button type="button" className="mt-5 w-full" onClick={close}>
          {copy.guideClose}
        </Button>
      </Modal>
    </>
  );
}
