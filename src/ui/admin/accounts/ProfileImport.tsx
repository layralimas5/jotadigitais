import { AlertTriangle, DownloadCloud, ExternalLink, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { lookupAccountProfile, uploadImage, type AdminDeps } from "@/application/admin-use-cases";
import { formatCount } from "@/domain/account";
import { insightsOf, isProfileLink, type ProfileLookup, type StoredProfileImages } from "@/domain/profile-lookup";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/form/Fields";
import { PlatformGlyph } from "@/ui/components/PlatformGlyph";
import { InlineError } from "../components/AdminUi";
import { useMutation } from "../hooks";
import { formatDate } from "../lib/dates";
import { blobFromDataUrl } from "../lib/data-url";
import { prepareImage } from "../lib/prepare-image";

export interface ImportedProfile {
  profile: ProfileLookup;
  /** Imagens já enviadas para o nosso armazenamento; a que não subir fica de fora. */
  images: StoredProfileImages;
}

/** A imagem vem da rede como data URL: passa pelo mesmo tratamento (WebP, tamanho) das fotos enviadas à mão. */
async function storeImage(deps: AdminDeps, dataUrl: string | null, name: string): Promise<string | null> {
  if (!dataUrl) return null;
  try {
    const blob = blobFromDataUrl(dataUrl);
    const prepared = await prepareImage(new File([blob], name, { type: blob.type }));
    return (await uploadImage(deps, prepared, "accounts")).url;
  } catch (error) {
    console.error(`Imagem "${name}" não foi salva`, error);
    return null;
  }
}

async function storeImages(deps: AdminDeps, profile: ProfileLookup): Promise<StoredProfileImages> {
  const [avatarUrl, coverUrl, ...postUrls] = await Promise.all([
    storeImage(deps, profile.avatarDataUrl, "perfil"),
    storeImage(deps, profile.coverDataUrl, "capa"),
    ...profile.postDataUrls.map((dataUrl, index) => storeImage(deps, dataUrl, `post-${index + 1}`)),
  ]);
  return { avatarUrl: avatarUrl ?? null, coverUrl: coverUrl ?? null, postUrls: postUrls.filter((url): url is string => url !== null) };
}

async function importProfile(deps: AdminDeps, url: string): Promise<ImportedProfile> {
  const profile = await lookupAccountProfile(deps, url);
  return { profile, images: await storeImages(deps, profile) };
}

function imageNotesOf({ profile, images }: ImportedProfile): string[] {
  const notes: string[] = [];
  if (!profile.avatarDataUrl) notes.push("A rede não mandou a foto de perfil: envie a foto à mão.");
  else if (!images.avatarUrl) notes.push("A foto de perfil veio, mas não foi salva. Tente de novo ou envie à mão.");
  const lostPosts = profile.postDataUrls.length - images.postUrls.length;
  if (lostPosts > 0 || (profile.coverDataUrl && !images.coverUrl)) notes.push("Algumas imagens do mockup não foram salvas. Tente de novo ou envie à mão.");
  return notes;
}

function notesOf(imported: ImportedProfile): string[] {
  const { profile } = imported;
  const notes = imageNotesOf(imported);
  if (profile.approximate) notes.push("A rede mostra alguns números arredondados. Confira o valor exato no app antes de salvar.");
  if (profile.platform === "youtube") notes.push("Horas de exibição e monetização não são públicas: preencha pelo YouTube Studio.");
  else notes.push("Monetização não aparece no perfil público: marque à mão se a conta já recebe.");
  if (profile.platform === "instagram") notes.push("As fotos da grade do Instagram não vêm na busca: envie no mockup do celular.");
  return notes;
}

function ImportSummary({ imported }: { imported: ImportedProfile }) {
  const { profile } = imported;
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
        {notesOf(imported).map((note) => (
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

/** Espera o Jota parar de digitar antes de buscar sozinho; colar o link inteiro dispara logo depois disso. */
const AUTO_FETCH_DELAY_MS = 700;

/**
 * Link do perfil + botão que puxa seguidores, curtidas, foto e o resto direto da rede.
 * Colou (ou trocou) o link de um perfil, a busca roda sozinha; o botão continua para atualizar os números depois.
 */
export function ProfileImport({ url, syncedAt, error, onUrlChange, onImported }: ProfileImportProps) {
  const lookup = useMutation(importProfile);
  const [last, setLast] = useState<ImportedProfile | null>(null);
  const canFetch = url.trim().length > 0 && !lookup.pending;
  // O link que já foi buscado (ou que veio salvo com dados puxados): não busca de novo só por abrir a ficha.
  const fetchedUrl = useRef(syncedAt ? url.trim() : "");
  const onImportedRef = useRef(onImported);
  useEffect(() => {
    onImportedRef.current = onImported;
  });

  const run = async (target = url) => {
    if (target.trim().length === 0 || lookup.pending) return;
    fetchedUrl.current = target.trim();
    const imported = await lookup.run(target);
    if (!imported) return;
    // A busca troca o link pelo endereço oficial do perfil: esse também já está buscado.
    fetchedUrl.current = imported.profile.profileUrl.trim();
    setLast(imported);
    onImportedRef.current(imported);
  };
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  });

  useEffect(() => {
    const target = url.trim();
    if (!isProfileLink(target) || target === fetchedUrl.current) return;
    const timer = window.setTimeout(() => void runRef.current(target), AUTO_FETCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [url]);

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
          hint="TikTok, Instagram ou YouTube. Colou o link, os seguidores, o nome, a foto, a bio e as capas das últimas publicações vêm sozinhos do perfil público. O site mostra um botão para o cliente abrir a conta."
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
      {last && !lookup.error && <ImportSummary imported={last} />}
    </div>
  );
}
