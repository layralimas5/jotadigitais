import { Download, ImageOff } from "lucide-react";
import { useState } from "react";
import type { SupportAttachment } from "@/domain/support-ticket";
import { downloadUrlOf } from "./download-url";
import { ImageLightbox, type LightboxImage } from "@/ui/components/ImageLightbox";

function Unavailable({ name }: { name: string }) {
  return (
    <span className="grid size-full place-items-center gap-1 p-3 text-center text-xs text-mist">
      <ImageOff aria-hidden className="size-5" />
      <span className="line-clamp-2 break-all">{name} indisponível agora</span>
    </span>
  );
}

/**
 * Vídeo que toca no chat, com o botão de baixar. Se o navegador não decodificar (ex.: HEVC de iPhone no Chrome
 * do Windows, que toca só o som com a tela preta), avisa e deixa baixar para assistir no computador.
 */
function VideoAttachment({ url, name }: { url: string; name: string }) {
  const [unplayable, setUnplayable] = useState(false);
  return (
    <>
      <video
        src={url}
        controls
        playsInline
        preload="metadata"
        className="max-h-96 w-full"
        aria-label={name}
        onError={() => setUnplayable(true)}
        onLoadedData={(event) => setUnplayable(event.currentTarget.videoWidth === 0)}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-ink px-3 py-2 text-xs">
        <span className={unplayable ? "text-amber-200" : "min-w-0 truncate text-mist"}>
          {unplayable ? "Este navegador não consegue mostrar o vídeo. Baixe para assistir." : name}
        </span>
        <a
          href={downloadUrlOf(url, name)}
          download={name}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-medium text-electric-soft hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-electric"
        >
          <Download aria-hidden className="size-3.5" /> Baixar vídeo
        </a>
      </div>
    </>
  );
}

/** Imagens ampliam na mesma aba (com setas entre as do mesmo envio); vídeos tocam ali mesmo. */
export function AttachmentGallery({ attachments }: { attachments: readonly SupportAttachment[] }) {
  const [opened, setOpened] = useState<number | null>(null);
  if (attachments.length === 0) return null;
  const images: LightboxImage[] = attachments.flatMap((item) =>
    item.kind === "image" && item.url ? [{ url: item.url, name: item.name }] : [],
  );
  return (
    <>
      <ul aria-label="Anexos" className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {attachments.map((attachment) => (
          <li
            key={attachment.id}
            className={
              attachment.kind === "video"
                ? "col-span-2 overflow-hidden rounded-xl border border-line bg-black"
                : "aspect-video overflow-hidden rounded-xl border border-line bg-ink"
            }
          >
            {!attachment.url ? (
              <Unavailable name={attachment.name} />
            ) : attachment.kind === "image" ? (
              <button
                type="button"
                onClick={() => setOpened(images.findIndex((image) => image.url === attachment.url))}
                className="block size-full cursor-zoom-in"
                aria-label={`Ampliar ${attachment.name}`}
              >
                <img
                  src={attachment.url}
                  alt={attachment.name}
                  loading="lazy"
                  className="size-full object-cover transition-transform hover:scale-[1.03]"
                />
              </button>
            ) : (
              <VideoAttachment url={attachment.url} name={attachment.name} />
            )}
          </li>
        ))}
      </ul>
      <ImageLightbox images={images} index={opened} onChange={setOpened} downloadHrefOf={(image) => downloadUrlOf(image.url, image.name)} />
    </>
  );
}
