import { MessageCircle } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import { parseAffiliateCode } from "@/domain/affiliate";
import { affiliateWhatsAppMessage } from "@/domain/affiliate-rewards";
import { whatsappMessageUrl } from "@/domain/store-settings";
import { buttonClasses } from "@/ui/components/Button";
import { useDocumentMeta } from "@/ui/hooks/useDocumentMeta";
import { trackAffiliateCode } from "@/ui/hooks/useAffiliateRef";
import { useStoreSettings, useStoreSettingsReady } from "@/ui/hooks/useStoreSettings";

/** Espera curta pelo rastreio antes de abrir o WhatsApp: o clique conta, mas ninguém fica preso na tela. */
const TRACK_TIMEOUT_MS = 1500;

/**
 * /indicacao/<código>: o link de WhatsApp do afiliado. Conta o clique, guarda a indicação neste navegador (se a
 * pessoa comprar pelo site depois, conta para ele) e abre o WhatsApp da loja com o código na mensagem.
 */
export default function AffiliateWhatsAppPage() {
  useDocumentMeta("Abrindo o WhatsApp");
  const { code: rawCode } = useParams();
  const code = parseAffiliateCode(rawCode ?? null);
  const { whatsappUrl } = useStoreSettings();
  const ready = useStoreSettingsReady();
  const started = useRef(false);

  const target = useMemo(() => {
    if (!whatsappUrl) return null;
    return code ? whatsappMessageUrl(whatsappUrl, affiliateWhatsAppMessage(code)) : whatsappUrl;
  }, [code, whatsappUrl]);

  useEffect(() => {
    if (!ready || !target || started.current) return;
    started.current = true;
    const tracking = code ? trackAffiliateCode(code) : Promise.resolve(false);
    const timeout = new Promise((resolve) => window.setTimeout(resolve, TRACK_TIMEOUT_MS));
    void Promise.race([tracking, timeout]).then(() => window.location.replace(target));
  }, [code, ready, target]);

  return (
    <main id="conteudo" className="grid min-h-[60vh] place-items-center px-4 py-16 text-center">
      <div className="max-w-sm">
        <span aria-hidden className="mx-auto grid size-14 place-items-center rounded-2xl bg-electric/15 text-electric">
          <MessageCircle className="size-7" />
        </span>
        <h1 className="mt-5 font-display text-2xl font-semibold text-white">Abrindo o WhatsApp da loja</h1>
        <p role="status" className="mt-2 text-sm text-fog">
          {ready && !target ? "O WhatsApp da loja não está disponível agora." : "Só um instante. Se não abrir sozinho, toque no botão."}
        </p>
        {target && (
          <a href={target} className={buttonClasses({ className: "mt-6" })}>
            Abrir o WhatsApp
          </a>
        )}
      </div>
    </main>
  );
}
