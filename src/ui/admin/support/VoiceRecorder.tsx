import { Mic, Square, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/ui/lib/cn";

/** Gravação mais longa que isso para sozinha: áudio de suporte é recado, e o arquivo fica leve. */
const MAX_SECONDS = 5 * 60;

/** Chrome e Firefox gravam WebM/Opus; o Safari (iPhone) só grava MP4. */
const PREFERRED_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

const EXTENSION_OF: Record<string, string> = { "audio/webm": "webm", "audio/mp4": "m4a", "audio/ogg": "ogg" };

type RecorderState = "idle" | "recording" | "denied" | "unsupported";

function pickMimeType(): string | undefined {
  return PREFERRED_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

const isSupported = () => typeof window !== "undefined" && "MediaRecorder" in window && Boolean(navigator.mediaDevices?.getUserMedia);

function fileOf(chunks: Blob[], mimeType: string): File {
  const baseType = mimeType.split(";")[0] ?? "audio/webm";
  const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
  return new File(chunks, `audio-${stamp}.${EXTENSION_OF[baseType] ?? "webm"}`, { type: baseType });
}

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/** Microfone do aparelho: grava, para e entrega o áudio como arquivo; descartar não entrega nada. */
function useVoiceRecorder(onRecorded: (file: File) => void) {
  const [state, setState] = useState<RecorderState>(() => (isSupported() ? "idle" : "unsupported"));
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const discard = useRef(false);
  const onRecordedRef = useRef(onRecorded);
  useEffect(() => {
    onRecordedRef.current = onRecorded;
  });

  const stop = useCallback((keep: boolean) => {
    discard.current = !keep;
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, []);

  const start = useCallback(async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      console.error(error);
      setState("denied");
      return;
    }
    const mimeType = pickMimeType();
    const media = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    const chunks: Blob[] = [];
    media.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    media.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      recorder.current = null;
      setState("idle");
      setSeconds(0);
      if (!discard.current && chunks.length > 0) onRecordedRef.current(fileOf(chunks, media.mimeType || mimeType || "audio/webm"));
    };
    discard.current = false;
    recorder.current = media;
    media.start(1000);
    setSeconds(0);
    setState("recording");
  }, []);

  // Relógio da gravação; no limite, para e anexa sozinho.
  useEffect(() => {
    if (state !== "recording") return;
    const timer = window.setInterval(() => setSeconds((current) => current + 1), 1000);
    return () => window.clearInterval(timer);
  }, [state]);
  useEffect(() => {
    if (state === "recording" && seconds >= MAX_SECONDS) stop(true);
  }, [state, seconds, stop]);

  // Saiu da tela gravando: solta o microfone sem anexar.
  useEffect(() => () => stop(false), [stop]);

  return { state, seconds, start, stop };
}

/** Botão "Gravar áudio": enquanto grava, mostra o tempo e as opções de anexar ou descartar. */
export function VoiceRecorder({ onRecorded, disabled = false }: { onRecorded: (file: File) => void; disabled?: boolean }) {
  const recorder = useVoiceRecorder(onRecorded);

  if (recorder.state === "unsupported") return null;

  if (recorder.state === "recording") {
    return (
      <div role="status" aria-live="polite" className="inline-flex flex-wrap items-center gap-2 rounded-full border border-alert/40 bg-alert/[0.08] py-1 pr-1 pl-3">
        <span aria-hidden className="size-2.5 animate-pulse rounded-full bg-alert motion-reduce:animate-none" />
        <span className="text-sm font-semibold text-white tabular-nums">
          Gravando {clock(recorder.seconds)}
          <span className="sr-only"> de no máximo {clock(MAX_SECONDS)}</span>
        </span>
        <button
          type="button"
          onClick={() => recorder.stop(true)}
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-3 text-sm font-semibold text-ink hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric"
        >
          <Square aria-hidden className="size-3.5 fill-current" /> Parar e anexar
        </button>
        <button
          type="button"
          onClick={() => recorder.stop(false)}
          aria-label="Descartar a gravação"
          className="grid size-8 place-items-center rounded-full text-mist hover:bg-white/[0.08] hover:text-white"
        >
          <Trash2 aria-hidden className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={() => void recorder.start()}
        disabled={disabled}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-line-strong px-4 py-2 text-sm font-medium text-fog transition-colors hover:border-white/30 hover:text-white",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric disabled:pointer-events-none disabled:opacity-50",
        )}
      >
        <Mic aria-hidden className="size-4" /> Gravar áudio
      </button>
      {recorder.state === "denied" && (
        <p role="alert" className="text-xs font-medium text-[#ff7a7a]">
          O microfone foi bloqueado. Libere o acesso ao microfone para este site nas configurações do navegador.
        </p>
      )}
    </div>
  );
}
