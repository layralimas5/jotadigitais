import { Camera, Trash2 } from "lucide-react";
import { useId, useRef, useState, type ChangeEvent } from "react";
import { updateAvatar } from "@/application/admin-use-cases";
import type { AdminSession } from "@/application/ports";
import { Button } from "@/ui/components/Button";
import { PersonAvatar } from "../components/PersonAvatar";
import { useAdminView } from "../admin-view";
import { prepareAvatar } from "../lib/prepare-image";
import { useAdminSession } from "../session";
import { useToast } from "../toast";

type Busy = "upload" | "remove" | null;

/** Foto de perfil: escolhe, recorta quadrada no aparelho e salva na hora. */
export function AvatarField({ session }: { session: AdminSession }) {
  const { deps } = useAdminView();
  const { refresh } = useAdminSession();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const [busy, setBusy] = useState<Busy>(null);
  const displayName = session.name ?? session.email;

  const run = async (kind: Exclude<Busy, null>, action: () => Promise<void>, done: string) => {
    setBusy(kind);
    try {
      await action();
      await refresh();
      toast.show(done);
    } catch (reason) {
      console.error(reason);
      toast.show(reason instanceof Error ? reason.message : "Não foi possível salvar a foto. Tente de novo.", "error");
    } finally {
      setBusy(null);
    }
  };

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    void run("upload", async () => updateAvatar(deps, await prepareAvatar(file)), "Foto de perfil salva.");
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy !== null}
        aria-label={session.avatarUrl ? "Trocar foto de perfil" : "Escolher foto de perfil"}
        aria-describedby={hintId}
        className="group relative shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-electric disabled:cursor-wait"
      >
        <PersonAvatar name={displayName} src={session.avatarUrl} className="size-20 text-lg" />
        <span
          aria-hidden
          className="absolute -right-0.5 -bottom-0.5 grid size-8 place-items-center rounded-full border-2 border-ink bg-electric text-ink transition-transform group-hover:scale-110"
        >
          <Camera className="size-4" />
        </span>
        {busy && <span aria-hidden className="absolute inset-0 animate-pulse rounded-full bg-black/50" />}
      </button>

      <div className="min-w-0 flex-1 space-y-2">
        <p id={hintId} className="text-xs text-mist">
          Foto de perfil em JPG, PNG ou WebP. O centro da imagem vira o círculo.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => inputRef.current?.click()} disabled={busy !== null}>
            <Camera aria-hidden className="size-4" />
            {busy === "upload" ? "Enviando…" : session.avatarUrl ? "Trocar foto" : "Escolher foto"}
          </Button>
          {session.avatarUrl && (
            <Button
              variant="secondary"
              onClick={() => void run("remove", () => updateAvatar(deps, null), "Foto removida.")}
              disabled={busy !== null}
              className="text-alert hover:text-alert"
            >
              <Trash2 aria-hidden className="size-4" />
              {busy === "remove" ? "Removendo…" : "Remover foto"}
            </Button>
          )}
        </div>
      </div>

      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={onFile} className="sr-only" tabIndex={-1} aria-hidden />
    </div>
  );
}
