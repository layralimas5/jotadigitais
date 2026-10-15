import { ImagePlus, Loader2, X } from "lucide-react";
import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { uploadImage } from "@/application/admin-use-cases";
import type { MediaFolder, UploadedImage } from "@/application/ports";
import { cn } from "@/ui/lib/cn";
import { useMutation } from "../hooks";
import { prepareImage } from "../lib/prepare-image";

function useImageUpload(folder: MediaFolder) {
  return useMutation(async (deps, file: File) => uploadImage(deps, await prepareImage(file), folder));
}

interface DropZoneProps {
  folder: MediaFolder;
  onUploaded: (image: UploadedImage) => void;
  className?: string;
  children: ReactNode;
  label: string;
  /** Permite levar o foco até aqui quando o campo tem erro. */
  name?: string;
}

/** Área de envio: clique, teclado (é um botão) ou arrastar e soltar. */
export function DropZone({ folder, onUploaded, className, children, label, name }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useImageUpload(folder);
  const [dragging, setDragging] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const uploaded = await upload.run(file);
    if (uploaded) onUploaded(uploaded);
  };

  const onDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDragging(false);
    void handleFile(event.dataTransfer.files[0]);
  };

  return (
    <div>
      <button
        type="button"
        name={name}
        aria-label={label}
        disabled={upload.pending}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "grid w-full place-items-center rounded-2xl border border-dashed text-center transition-colors disabled:cursor-wait",
          dragging ? "border-electric bg-electric/10" : "border-line-strong hover:border-white/30 hover:bg-white/[0.03]",
          className,
        )}
      >
        {upload.pending ? (
          <span className="flex flex-col items-center gap-2 text-sm text-mist">
            <Loader2 aria-hidden className="size-5 animate-spin text-electric" />
            Enviando…
          </span>
        ) : (
          children
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {upload.error && (
        <p role="alert" className="mt-2 text-xs font-medium text-[#ff7a7a]">
          {upload.error.message}
        </p>
      )}
    </div>
  );
}

interface SingleImageFieldProps {
  label: string;
  name: string;
  hint?: string;
  error?: string;
  folder: MediaFolder;
  value: string;
  alt: string;
  onUploaded: (image: UploadedImage) => void;
}

export function SingleImageField({ label, name, hint, error, folder, value, alt, onUploaded }: SingleImageFieldProps) {
  return (
    <div>
      <p className="text-sm font-medium text-fog">{label}</p>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start">
        {value && (
          <img src={value} alt={alt} className="h-56 w-auto self-start rounded-2xl border border-line object-contain" />
        )}
        <DropZone
          folder={folder}
          name={name}
          onUploaded={onUploaded}
          label={value ? "Trocar imagem" : "Enviar imagem"}
          className={cn(value ? "h-20 sm:h-56 sm:w-40" : "h-40", error && "border-alert/70")}
        >
          <span className="flex flex-col items-center gap-1.5 px-4 text-sm text-mist">
            <ImagePlus aria-hidden className="size-5 text-electric" />
            <span className="font-medium text-white">{value ? "Trocar print" : "Enviar print"}</span>
            {!value && <span className="text-xs">Clique ou arraste. PNG, JPG ou WebP.</span>}
          </span>
        </DropZone>
      </div>
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-[#ff7a7a]">{error}</p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-mist">{hint}</p>
      )}
    </div>
  );
}

interface GalleryFieldProps {
  label: string;
  hint?: string;
  error?: string;
  folder: MediaFolder;
  images: string[];
  max: number;
  onChange: (images: string[]) => void;
}

export function GalleryField({ label, hint, error, folder, images, max, onChange }: GalleryFieldProps) {
  return (
    <div>
      <p className="text-sm font-medium text-fog">{label}</p>
      <ul className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-4">
        {images.map((src, index) => (
          <li key={src} className="relative">
            <img src={src} alt={`Print ${index + 1}`} className="aspect-[9/16] w-full rounded-xl border border-line object-cover object-top" />
            <button
              type="button"
              onClick={() => onChange(images.filter((item) => item !== src))}
              aria-label={`Remover print ${index + 1}`}
              className="absolute top-1.5 right-1.5 grid size-8 place-items-center rounded-full bg-black/75 text-white backdrop-blur hover:bg-alert"
            >
              <X aria-hidden className="size-4" />
            </button>
          </li>
        ))}
        {images.length < max && (
          <li>
            <DropZone
              folder={folder}
              onUploaded={(image) => onChange([...images, image.url])}
              label="Adicionar print"
              className="aspect-[9/16]"
            >
              <span className="flex flex-col items-center gap-1.5 px-2 text-xs text-mist">
                <ImagePlus aria-hidden className="size-5 text-electric" />
                Adicionar
              </span>
            </DropZone>
          </li>
        )}
      </ul>
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-[#ff7a7a]">{error}</p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-mist">{hint}</p>
      )}
    </div>
  );
}

interface AvatarFieldProps {
  label: string;
  hint?: string;
  error?: string;
  value: string;
  onChange: (url: string) => void;
}

/** Foto redonda de perfil: enviar, trocar ou tirar. */
export function AvatarField({ label, hint, error, value, onChange }: AvatarFieldProps) {
  return (
    <div>
      <p className="text-sm font-medium text-fog">{label}</p>
      <div className="mt-2 flex items-center gap-4">
        <DropZone
          folder="accounts"
          name="avatarUrl"
          label={value ? "Trocar foto de perfil" : "Enviar foto de perfil"}
          onUploaded={(image) => onChange(image.url)}
          className={cn("size-20 overflow-hidden rounded-full p-0", error && "border-alert/70")}
        >
          {value ? (
            <img src={value} alt="" className="size-full object-cover" />
          ) : (
            <ImagePlus aria-hidden className="size-5 text-electric" />
          )}
        </DropZone>
        <div className="min-w-0 text-sm">
          <p className="text-mist">{value ? "Clique na foto para trocar." : "Clique ou arraste a foto."}</p>
          {value && (
            <button type="button" onClick={() => onChange("")} className="mt-1 inline-flex items-center gap-1 text-xs text-[#ff9a9a] hover:text-[#ffb3b3]">
              <X aria-hidden className="size-3.5" /> Tirar foto
            </button>
          )}
        </div>
      </div>
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-[#ff7a7a]">{error}</p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-mist">{hint}</p>
      )}
    </div>
  );
}
