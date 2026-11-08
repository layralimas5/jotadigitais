import { ImageOff } from "lucide-react";
import { useState } from "react";
import type { SupportAttachment } from "@/domain/support-ticket";
import { ImageLightbox, type LightboxImage } from "./ImageLightbox";

function Unavailable({ name }: { name: string }) {
  return (
    <span className="grid size-full place-items-center gap-1 p-3 text-center text-xs text-mist">
      <ImageOff aria-hidden className="size-5" />
      <span className="line-clamp-2 break-all">{name} indisponível agora</span>
    </span>
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
              <video src={attachment.url} controls preload="metadata" className="max-h-96 w-full" aria-label={attachment.name} />
            )}
          </li>
        ))}
      </ul>
      <ImageLightbox images={images} index={opened} onChange={setOpened} />
    </>
  );
}
