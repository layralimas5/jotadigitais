import { Film, Mic, Paperclip, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type ClipboardEvent } from "react";
import {
  ACCEPTED_AUDIO_TYPES,
  ACCEPTED_IMAGE_TYPES,
  ACCEPTED_VIDEO_TYPES,
  attachmentKindOf,
  contentTypeOf,
  attachmentProblem,
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_AUDIO_BYTES,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  type SupportUpload,
  VOICE_MESSAGE_TEXT,
} from "@/domain/support-ticket";
import { cn } from "@/ui/lib/cn";
import { VoiceRecorder } from "./VoiceRecorder";

// .opus e .m4a às vezes chegam sem tipo reconhecido pelo seletor: a extensão garante que aparecem para escolher.
const ACCEPT = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES, ...ACCEPTED_AUDIO_TYPES, ".opus", ".m4a"].join(",");
const MB = 1024 * 1024;
const HINT = `Até ${MAX_ATTACHMENTS_PER_MESSAGE} arquivos: imagens de até ${MAX_IMAGE_BYTES / MB} MB, vídeos de até ${MAX_VIDEO_BYTES / MB} MB e áudios de até ${MAX_AUDIO_BYTES / MB} MB.`;

/** Arquivo escolhido com a prévia local (só para mostrar antes de enviar). */
export interface PickedFile {
  id: string;
  upload: SupportUpload;
  previewUrl: string;
}

export const uploadsOf = (files: readonly PickedFile[]): SupportUpload[] => files.map((file) => file.upload);

/** Mandou só o áudio, sem escrever: o texto vira "Mensagem de voz" (a conversa sempre tem texto). */
export const textOrVoice = (text: string, files: readonly PickedFile[]): string =>
  !text.trim() && files.some((file) => file.upload.kind === "audio") ? VOICE_MESSAGE_TEXT : text;

/** Separa o que pode ir (com prévia) do motivo do primeiro arquivo recusado. */
function pickFiles(chosen: readonly File[], room: number): { accepted: PickedFile[]; problem: string | null } {
  const problems: string[] = [];
  const accepted: PickedFile[] = [];
  for (const file of chosen) {
    const type = contentTypeOf(file);
    const kind = attachmentKindOf(type);
    const reason = attachmentProblem({ name: file.name, type, size: file.size });
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
      upload: { file, name, kind, contentType: type },
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

/** Áudio escolhido: toca ali mesmo antes de enviar. */
function AudioPreview({ file, onRemove }: { file: PickedFile; onRemove: () => void }) {
  return (
    <li className="flex items-center gap-2 rounded-xl border border-line bg-ink p-2">
      <Mic aria-hidden className="ml-1 size-4 shrink-0 text-electric" />
      <audio src={file.previewUrl} controls preload="metadata" aria-label={file.upload.name} className="h-9 min-w-0 flex-1" />
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Tirar ${file.upload.name}`}
        className="grid size-8 shrink-0 place-items-center rounded-full text-mist transition-colors hover:bg-alert hover:text-white"
      >
        <X aria-hidden className="size-4" />
      </button>
    </li>
  );
}

/** Botões "Anexar arquivo" e "Gravar áudio", com as prévias e o motivo de qualquer arquivo recusado. */
export function AttachmentPicker({ files, problem, onFiles, onRemove, disabled = false }: AttachmentPickerProps) {
  const inputId = useId();
  const room = MAX_ATTACHMENTS_PER_MESSAGE - files.length;
  const audios = files.filter((file) => file.upload.kind === "audio");
  const visuals = files.filter((file) => file.upload.kind !== "audio");

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(event.target.files ?? []);
    event.target.value = "";
    onFiles(chosen);
  };

  return (
    <div>
      <div className="flex flex-wrap items-start gap-2">
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
          <Paperclip aria-hidden className="size-4" /> Anexar arquivo
        </label>
        <VoiceRecorder onRecorded={(file) => onFiles([file])} disabled={disabled || room <= 0} />
      </div>
      <p className="mt-1.5 text-xs text-mist">
        {HINT} Ou copie um print e cole (Ctrl+V) direto na mensagem.
      </p>
      {problem && (
        <p role="alert" className="mt-1.5 text-xs font-medium text-[#ff7a7a]">
          {problem}
        </p>
      )}
      {audios.length > 0 && (
        <ul aria-label="Áudios anexados" className="mt-3 grid gap-2">
          {audios.map((file) => (
            <AudioPreview key={file.id} file={file} onRemove={() => onRemove(file.id)} />
          ))}
        </ul>
      )}
      {visuals.length > 0 && (
        <ul aria-label="Arquivos anexados" className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {visuals.map((file) => (
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
