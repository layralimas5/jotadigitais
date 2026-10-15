import { AlertTriangle, DownloadCloud, ExternalLink, RefreshCw, Sparkles } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { lookupAccountProfile, uploadImage, type AdminDeps } from "@/application/admin-use-cases";
import { formatCount } from "@/domain/account";
import { insightsOf, type ProfileLookup } from "@/domain/profile-lookup";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/form/Fields";
import { PlatformGlyph } from "@/ui/components/PlatformGlyph";
import { InlineError } from "../components/AdminUi";
import { useMutation } from "../hooks";
import { formatDate } from "../lib/dates";
import { prepareImage } from "../lib/prepare-image";

export interface ImportedProfile {
  profile: ProfileLookup;
  /** Foto já enviada para o nosso armazenamento; nula se a rede não entregou foto. */
  avatarUrl: string | null;
}

/** A foto vem da rede como data URL: passa pelo mesmo tratamento (WebP, tamanho) das fotos enviadas à mão. */
async function storeAvatar(deps: AdminDeps, dataUrl: string | null): Promise<string | null> {
  if (!dataUrl) return null;
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const prepared = await prepareImage(new File([blob], "perfil", { type: blob.type }));
    return (await uploadImage(deps, prepared, "accounts")).url;
  } catch (error) {
    console.error("Foto do perfil não foi salva", error);
    return null;
  }
}

async function importProfile(deps: AdminDeps, url: string): Promise<ImportedProfile> {
  const profile = await lookupAccountProfile(deps, url);
  return { profile, avatarUrl: await storeAvatar(deps, profile.avatarDataUrl) };
}

function notesOf(profile: ProfileLookup): string[] {
  const notes: string[] = [];
  if (profile.approximate) notes.push("A rede mostra alguns números arredondados. Confira o valor exato no app antes de salvar.");
  if (profile.platform === "youtube") notes.push("Horas de exibição e monetização não são públicas: preencha pelo YouTube Studio.");
  else notes.push("Monetização não aparece no perfil público: marque à mão se a conta já recebe.");
  return notes;
}

function ImportSummary({ profile }: { profile: ProfileLookup }) {
  const numbers = [
    { label: profile.platform === "youtube" ? "Inscritos" : "Seguidores", value: profile.followers },
    { label: "Seguindo", value: profile.following },
    { label: "Curtidas", value: profile.likes },
    { label: "Publicações", value: profile.posts },
    { label: "Vídeos", value: profile.videos },
    { label: "Visualizações", value: profile.views },
  ].filter((item): item is { label: string; value: number } => item.value !== null);
  const insights = insightsOf(profile);

  return (
    <div role="status" className="rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.05] p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-white">
        <PlatformGlyph platform={profile.platform} className="size-4" /> {profile.displayName}
        <span className="text-mist">{profile.handle}</span>
      </p>
      <p className="mt-0.5 text-xs text-mist">Dados preenchidos abaixo. Revise e salve.</p>
      <dl className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {numbers.map((item) => (
          <div key={item.label} className="rounded-xl bg-black/30 px-2.5 py-2">
            <dt className="text-[0.68rem] text-mist">{item.label}</dt>
            <dd className="font-display text-sm font-semibold text-white tabular-nums">{formatCount(item.value)}</dd>
          </div>
        ))}
      </dl>
      {insights.length > 0 && (
        <div className="mt-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-fog">
            <Sparkles aria-hidden className="size-3.5 text-electric-soft" /> Análise rápida
          </p>
          <dl className="mt-1.5 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
            {insights.map((insight) => (
              <div key={insight.label} className="flex justify-between gap-3 border-b border-white/[0.05] py-1">
                <dt className="text-mist">{insight.label}</dt>
                <dd className="text-white tabular-nums">{insight.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      <ul className="mt-3 space-y-1">
        {notesOf(profile).map((note) => (
          <li key={note} className="flex gap-1.5 text-xs text-fog">
            <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0 text-amber-300" /> {note}
          </li>
        ))}
      </ul>
    </div>
  );
}

interface ProfileImportProps {
  url: string;
  syncedAt: string | null;
  error?: string;
  onUrlChange: (url: string) => void;
  onImported: (imported: ImportedProfile) => void;
}

/** Link do perfil + botão que puxa seguidores, curtidas, foto e o resto direto da rede. */
export function ProfileImport({ url, syncedAt, error, onUrlChange, onImported }: ProfileImportProps) {
  const lookup = useMutation(importProfile);
  const [last, setLast] = useState<ProfileLookup | null>(null);
  const canFetch = url.trim().length > 0 && !lookup.pending;

  const run = async () => {
    if (!canFetch) return;
    const imported = await lookup.run(url);
    if (!imported) return;
    setLast(imported.profile);
    onImported(imported);
  };

  /** Enter no campo busca os dados em vez de enviar o formulário inteiro. */
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void run();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <TextField
          label="Link da conta"
          name="profileUrl"
          type="url"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="https://www.tiktok.com/@nome"
          className="min-w-0 flex-1"
          value={url}
          onChange={(event) => onUrlChange(event.target.value)}
          onKeyDown={onKeyDown}
          error={error}
          hint="TikTok, Instagram ou YouTube. Os números, o nome e a foto vêm direto do perfil público."
        />
        <Button type="button" variant="secondary" size="lg" className="shrink-0 sm:mt-7" disabled={!canFetch} onClick={() => void run()}>
          {lookup.pending ? (
            <RefreshCw aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
          ) : (
            <DownloadCloud aria-hidden className="size-4" />
          )}
          {lookup.pending ? "Buscando…" : syncedAt ? "Atualizar dados" : "Puxar dados"}
        </Button>
      </div>

      {syncedAt && !last && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mist">
          Números puxados da rede em {formatDate(syncedAt)}.
          {url && (
            <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-electric-soft hover:underline">
              Abrir perfil <ExternalLink aria-hidden className="size-3" />
            </a>
          )}
        </p>
      )}
      {lookup.error && <InlineError message={lookup.error.message} />}
      {last && !lookup.error && <ImportSummary profile={last} />}
    </div>
  );
}
