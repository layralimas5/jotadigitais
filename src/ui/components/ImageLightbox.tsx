import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { useEffect, useRef, type KeyboardEvent } from "react";

export interface LightboxImage {
  url: string;
  name: string;
}

interface ImageLightboxProps {
  images: readonly LightboxImage[];
  /** Posição da imagem aberta; nulo fecha. */
  index: number | null;
  onChange: (index: number | null) => void;
  /** Link de download da imagem; sem ele, o botão de baixar não aparece (ex.: prints na página da conta). */
  downloadHrefOf?: (image: LightboxImage) => string;
}

const controlClass =
  "grid size-11 place-items-center rounded-full bg-black/70 text-white ring-1 ring-white/15 backdrop-blur transition-colors hover:bg-white/15";

/** Imagem em tamanho grande na mesma aba. Esc ou clique fora fecha; setas passam para as outras do mesmo envio. */
export function ImageLightbox({ images, index, onChange, downloadHrefOf }: ImageLightboxProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const open = index !== null;
  const image = index === null ? null : images[index];
  const many = images.length > 1;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const step = (delta: number) => {
    if (index === null || !many) return;
    onChange((index + delta + images.length) % images.length);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === "ArrowRight") step(1);
    if (event.key === "ArrowLeft") step(-1);
  };

  return (
    <dialog
      ref={ref}
      onClose={() => onChange(null)}
      onKeyDown={onKeyDown}
      // Clique no fundo (fora da imagem e dos botões) fecha.
      onClick={(event) => event.target === event.currentTarget && onChange(null)}
      aria-label={image ? `Imagem: ${image.name}` : "Imagem"}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-0 backdrop:bg-black/90 backdrop:backdrop-blur-sm"
    >
      {image && (
        <div className="pointer-events-none flex size-full items-center justify-center p-4 sm:p-12" onClick={() => onChange(null)}>
          <img
            src={image.url}
            alt={image.name}
            onClick={(event) => event.stopPropagation()}
            className="pointer-events-auto max-h-full max-w-full rounded-xl object-contain shadow-2xl"
          />
        </div>
      )}
      <div className="absolute top-3 right-3 flex gap-2 sm:top-5 sm:right-5">
        {image && downloadHrefOf && (
          <a
            href={downloadHrefOf(image)}
            download={image.name}
            aria-label={`Baixar ${image?.name ?? "imagem"}`}
            className={controlClass}
          >
            <Download aria-hidden className="size-5" />
          </a>
        )}
        <button type="button" autoFocus onClick={() => onChange(null)} aria-label="Fechar imagem" className={controlClass}>
          <X aria-hidden className="size-5" />
        </button>
      </div>
      {many && (
        <>
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Imagem anterior"
            className={`${controlClass} absolute top-1/2 left-3 -translate-y-1/2 sm:left-5`}
          >
            <ChevronLeft aria-hidden className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Próxima imagem"
            className={`${controlClass} absolute top-1/2 right-3 -translate-y-1/2 sm:right-5`}
          >
            <ChevronRight aria-hidden className="size-5" />
          </button>
          <p
            aria-live="polite"
            className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-xs text-white"
          >
            {(index ?? 0) + 1} de {images.length}
          </p>
        </>
      )}
    </dialog>
  );
}
