import { Check, Palette } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { getTagColors, saveTagColor } from "@/application/admin-use-cases";
import { TAG_COLOR_PRESETS, readableTextOn } from "@/domain/tag-color";
import { tagColorStyle } from "@/ui/components/account/AccountBadges";
import { publishTagColor, replaceTagColors, useTagColors } from "@/ui/hooks/useTagColors";
import { cn } from "@/ui/lib/cn";
import { useAdminDeps } from "../admin-view";
import { useAdminQuery } from "../hooks";
import { useToast } from "../toast";

export interface ColorableTag {
  key: string;
  label: string;
}

/** Carrega as cores pelo acesso do painel (inclusive no ambiente de teste) e entrega a cópia que o site usa. */
export function useAdminTagColors() {
  const state = useAdminQuery(getTagColors, "tag-colors");
  const loaded = state.status === "success" ? state.data : null;
  useEffect(() => {
    if (loaded) replaceTagColors(loaded);
  }, [loaded]);
  return useTagColors();
}

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric";

/**
 * O Jota escolhe a tag, escolhe a cor de fundo e salva. A cor vale para todas as contas com essa tag,
 * no painel, no card da vitrine e na página da conta.
 */
export function TagColorPicker({ tags }: { tags: readonly ColorableTag[] }) {
  const deps = useAdminDeps();
  const toast = useToast();
  const colors = useTagColors();
  const selectId = useId();
  const [open, setOpen] = useState(false);
  const [tagKey, setTagKey] = useState(tags[0]?.key ?? "");
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const current = tags.find((tag) => tag.key === tagKey) ?? tags[0];
  const saved = current ? colors[current.key] : undefined;
  const color = draft ?? saved;

  const chooseTag = (key: string) => {
    setTagKey(key);
    setDraft(null);
  };

  const close = () => {
    setOpen(false);
    setDraft(null);
  };

  const save = async (next: string | null) => {
    if (!current) return;
    setSaving(true);
    try {
      await saveTagColor(deps, { key: current.key, color: next });
      publishTagColor(current.key, next);
      setDraft(null);
      toast.show(next ? `Cor da tag "${current.label}" salva.` : `A tag "${current.label}" voltou para a cor padrão.`, "success");
    } catch (error) {
      console.error("Falha ao salvar a cor da tag", error);
      toast.show(error instanceof Error ? error.message : "Não foi possível salvar a cor.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn("mt-3 inline-flex items-center gap-1.5 rounded-full text-xs font-medium text-fog hover:text-white", focusRing)}
      >
        <Palette aria-hidden className="size-3.5" /> Mudar a cor das tags
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border border-line-strong bg-white/[0.02] p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <label htmlFor={selectId} className="text-xs font-medium text-fog">
            Tag
          </label>
          <select
            id={selectId}
            value={current?.key ?? ""}
            onChange={(event) => chooseTag(event.target.value)}
            className="h-9 min-w-44 rounded-full border border-line-strong bg-ink px-3 text-sm text-white focus:border-electric focus:outline-none"
          >
            {tags.map((tag) => (
              <option key={tag.key} value={tag.key}>
                {colors[tag.key] ? `${tag.label} (com cor)` : tag.label}
              </option>
            ))}
          </select>
        </div>
        {current && (
          <span
            style={tagColorStyle(color)}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[0.7rem] font-semibold tracking-wide",
              !color && "border-white/15 bg-white/[0.05] text-fog",
            )}
          >
            <span aria-hidden className="size-1.5 rounded-full bg-current" />
            <span className="sr-only">Prévia: </span>
            {current.label}
          </span>
        )}
      </div>

      <fieldset className="mt-4">
        <legend className="text-xs font-medium text-fog">Cor de fundo</legend>
        <ul className="mt-2 flex flex-wrap items-center gap-2">
          {TAG_COLOR_PRESETS.map((preset) => (
            <li key={preset}>
              <button
                type="button"
                aria-label={`Cor ${preset}`}
                aria-pressed={color === preset}
                disabled={saving}
                onClick={() => preset !== saved && save(preset)}
                style={{ backgroundColor: preset }}
                className={cn("grid size-8 place-items-center rounded-full border border-white/15 transition-transform hover:scale-110", focusRing)}
              >
                {color === preset && <Check aria-hidden className="size-4" style={{ color: readableTextOn(preset) }} />}
              </button>
            </li>
          ))}
          <li>
            <label
              className={cn(
                "inline-flex h-8 cursor-pointer items-center gap-2 rounded-full border border-dashed border-line-strong px-3 text-xs text-fog hover:text-white",
                "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-electric",
              )}
            >
              <input
                type="color"
                value={color ?? TAG_COLOR_PRESETS[0]}
                onChange={(event) => setDraft(event.target.value.toLowerCase())}
                className="size-5 cursor-pointer rounded-full border-0 bg-transparent p-0"
              />
              Outra cor
            </label>
          </li>
        </ul>
      </fieldset>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {draft && draft !== saved && (
          <button
            type="button"
            disabled={saving}
            onClick={() => save(draft)}
            className={cn("inline-flex h-9 items-center rounded-full bg-white px-4 text-sm font-semibold text-ink transition-opacity disabled:opacity-40", focusRing)}
          >
            {saving ? "Salvando..." : "Salvar esta cor"}
          </button>
        )}
        {saved && (
          <button
            type="button"
            disabled={saving}
            onClick={() => save(null)}
            className={cn("inline-flex h-9 items-center rounded-full border border-line-strong px-4 text-sm text-fog hover:text-white disabled:opacity-40", focusRing)}
          >
            Tirar cor
          </button>
        )}
        <button type="button" onClick={close} className={cn("ml-auto rounded text-xs text-mist hover:text-white", focusRing)}>
          Fechar
        </button>
      </div>
      <p className="mt-3 text-xs text-mist" aria-live="polite">
        {saving
          ? "Salvando a cor..."
          : "Clicou na cor, já salvou: vale na hora para todas as contas com essa tag, aqui e no site. Em Outra cor, escolha e clique em Salvar esta cor."}
      </p>
    </div>
  );
}
