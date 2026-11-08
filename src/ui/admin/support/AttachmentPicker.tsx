import { Film, Paperclip, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type ClipboardEvent } from "react";
import {
  ACCEPTED_IMAGE_TYPES,
  ACCEPTED_VIDEO_TYPES,
  attachmentKindOf,
  attachmentProblem,
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  type SupportUpload,
} from "@/domain/support-ticket";
import { cn } from "@/ui/lib/cn";

const ACCEPT = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES].join(",");
const HINT = `Até ${MAX_ATTACHMENTS_PER_MESSAGE} arquivos: imagens de até ${MAX_IMAGE_BYTES / 1024 / 1024} MB e vídeos de até ${MAX_VIDEO_BYTES / 1024 / 1024} MB.`;

/** Arquivo escolhido com a prévia local (só para mostrar antes de enviar). */
export interface PickedFile {
  id: string;
  upload: SupportUpload;
  previewUrl: string;
}

export const uploadsOf = (files: readonly PickedFile[]): SupportUpload[] => files.map((file) => file.upload);

/** Separa o que pode ir (com prévia) do motivo do primeiro arquivo recusado. */
function pickFiles(chosen: readonly File[], room: number): { accepted: PickedFile[]; problem: string | null } {
  const problems: string[] = [];
  const accepted: PickedFile[] = [];
  for (const file of chosen) {
    const kind = attachmentKindOf(file.type);
    const reason = attachmentProblem(file);
    if (reason || !kind) {
      problems.push(reason ?? `"${file.name}" não pode ser anexado.`);
      continue;
    }
    if (accepted.length >= room) {
      problems.push(`Cabem no máximo ${MAX_ATTACHMENTS_PER_MESSAGE} arquivos por mensagem.`);
      break;
    }
    // Print colado chega como "image.png": ganha um nome que diz o que é.
    const name = file.name && file.name !== "image.png" ? file.name : `print-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")}.png`;
    accepted.push({
      id: crypto.randomUUID(),
      upload: { file, name, kind, contentType: file.type },
      previewUrl: URL.createObjectURL(file),
    });
  }
  return { accepted, problem: problems[0] ?? null };
}

/**
 * Colar (Ctrl+V) um print ou arquivo na caixa de texto anexa direto, sem passar pelo botão.
 * Texto colado continua indo para a caixa normalmente.
 */
export function pasteFilesInto(addFiles: (files: File[]) => void) {
  return (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.files);
    if (files.length === 0) return;
    if (!event.clipboardData.getData("text/plain")) event.preventDefault();
    addFiles(files);
  };
}

/** Lista de arquivos escolhidos; as prévias são liberadas quando somem da tela. */
export function usePickedFiles() {
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const latest = useRef(files);
  useEffect(() => {
    latest.current = files;
  }, [files]);
  // Saiu da tela: libera as prévias que ainda existirem.
  useEffect(() => () => latest.current.forEach((file) => URL.revokeObjectURL(file.previewUrl)), []);
  return useMemo(
    () => ({
      files,
      /** Motivo do último arquivo recusado, escolhido pelo botão ou colado. */
      problem,
      addFiles: (chosen: File[]) => {
        const result = pickFiles(chosen, MAX_ATTACHMENTS_PER_MESSAGE - files.length);
        setProblem(result.problem);
        if (result.accepted.length) setFiles((current) => [...current, ...result.accepted]);
      },
      remove: (id: string) =>
        setFiles((current) => {
          const target = current.find((file) => file.id === id);
          if (target) URL.revokeObjectURL(target.previewUrl);
          return current.filter((file) => file.id !== id);
        }),
      clear: () => {
        setProblem(null);
        setFiles((current) => {
          current.forEach((file) => URL.revokeObjectURL(file.previewUrl));
          return [];
        });
      },
    }),
    [files, problem],
  );
}

interface AttachmentPickerProps {
  files: readonly PickedFile[];
  problem: string | null;
  onFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
}

/** Botão "Anexar imagem ou vídeo" com as prévias e o motivo de qualquer arquivo recusado. */
export function AttachmentPicker({ files, problem, onFiles, onRemove, disabled = false }: AttachmentPickerProps) {
  const inputId = useId();
  const room = MAX_ATTACHMENTS_PER_MESSAGE - files.length;

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(event.target.files ?? []);
    event.target.value = "";
    onFiles(chosen);
  };

  return (
    <div>
      <input id={inputId} type="file" multiple accept={ACCEPT} onChange={onChange} disabled={disabled || room <= 0} className="peer sr-only" />
      <label
        htmlFor={inputId}
        aria-disabled={disabled || room <= 0}
        className={cn(
          "inline-flex cursor-pointer items-center gap-2 rounded-full border border-line-strong px-4 py-2 text-sm font-medium text-fog transition-colors hover:border-white/30 hover:text-white",
          "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-electric",
          (disabled || room <= 0) && "pointer-events-none opacity-50",
        )}
      >
        <Paperclip aria-hidden className="size-4" /> Anexar imagem ou vídeo
      </label>
      <p className="mt-1.5 text-xs text-mist">
        {HINT} Ou copie um print e cole (Ctrl+V) direto na mensagem.
      </p>
      {problem && (
        <p role="alert" className="mt-1.5 text-xs font-medium text-[#ff7a7a]">
          {problem}
        </p>
      )}
      {files.length > 0 && (
        <ul aria-label="Arquivos anexados" className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {files.map((file) => (
            <li key={file.id} className="group relative aspect-square overflow-hidden rounded-xl border border-line bg-ink">
              {file.upload.kind === "image" ? (
                <img src={file.previewUrl} alt={file.upload.name} className="size-full object-cover" />
              ) : (
                <span className="grid size-full place-items-center gap-1 p-2 text-center text-[0.65rem] text-mist">
                  <Film aria-hidden className="size-6 text-electric" />
                  <span className="line-clamp-2 break-all">{file.upload.name}</span>
                </span>
              )}
              <button
                type="button"
                onClick={() => onRemove(file.id)}
                aria-label={`Tirar ${file.upload.name}`}
                className="absolute top-1 right-1 grid size-7 place-items-center rounded-full bg-black/80 text-white transition-colors hover:bg-alert"
              >
                <X aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
