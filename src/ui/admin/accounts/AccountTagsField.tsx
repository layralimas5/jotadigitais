import { Check, Plus } from "lucide-react";
import { useMemo, useState, type KeyboardEvent } from "react";
import { listAllAccounts } from "@/application/admin-use-cases";
import { MAX_ACCOUNT_TAG_LENGTH, MAX_ACCOUNT_TAGS, normalizeAccountTags, type ShopTier } from "@/domain/account";
import type { Platform } from "@/domain/platform";
import { MONETIZED_TAG_KEY, SHOP_TAG_KEY, customTagKey } from "@/domain/tag-color";
import { tagColorStyle } from "@/ui/components/account/AccountBadges";
import { cn } from "@/ui/lib/cn";
import { useAdminQuery } from "../hooks";
import { TagColorPicker, useAdminTagColors, type ColorableTag } from "./TagColorPicker";

type ChipTone = "pink" | "electric" | "emerald" | "custom";

const selectedTone: Record<ChipTone, string> = {
  pink: "border-pink/50 bg-pink/15 text-pink",
  electric: "border-electric/60 bg-electric/15 text-electric-soft",
  emerald: "border-emerald-400/50 bg-emerald-400/15 text-emerald-300",
  custom: "border-white/40 bg-white/10 text-white",
};

const chipBase =
  "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric";

interface TagChipProps {
  label: string;
  selected: boolean;
  tone: ChipTone;
  onToggle: () => void;
  disabled?: boolean;
  /** Cor que o Jota salvou para a tag: pinta o chip marcado e vira um ponto no desmarcado. */
  color?: string;
}

function TagChip({ label, selected, tone, onToggle, disabled, color }: TagChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onToggle}
      style={selected ? tagColorStyle(color) : undefined}
      className={cn(
        chipBase,
        selected ? !color && selectedTone[tone] : "border-line-strong text-mist hover:border-white/30 hover:text-white",
        "disabled:pointer-events-none disabled:opacity-40",
      )}
    >
      {selected && <Check aria-hidden className="size-3.5" />}
      {!selected && color && <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: color }} />}
      {label}
    </button>
  );
}

function CreateTag({ onCreate, disabled }: { onCreate: (tag: string) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const close = () => {
    setOpen(false);
    setDraft("");
  };
  const submit = () => {
    const tag = draft.trim().replace(/\s+/g, " ");
    if (tag) onCreate(tag);
    close();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submit();
    } else if (event.key === "Escape") {
      close();
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(chipBase, "border-dashed border-line-strong text-fog hover:border-electric hover:text-white disabled:pointer-events-none disabled:opacity-40")}
      >
        <Plus aria-hidden className="size-4" /> Criar tag
      </button>
    );
  }
  return (
    <input
      autoFocus
      name="tags"
      aria-label="Nome da tag nova (Enter cria, Esc cancela)"
      maxLength={MAX_ACCOUNT_TAG_LENGTH}
      autoComplete="off"
      placeholder="Nome da tag"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={onKeyDown}
      onBlur={submit}
      className="h-9 w-44 rounded-full border border-electric bg-ink px-3.5 text-sm text-white placeholder:text-mist/70 focus:outline-none"
    />
  );
}

/** Tags já criadas em qualquer conta: viram opções para marcar nas outras. */
function useCreatedTags(): string[] {
  const accounts = useAdminQuery(listAllAccounts, "account-tags");
  return useMemo(
    () => (accounts.status === "success" ? normalizeAccountTags(accounts.data.flatMap((account) => account.tags)) : []),
    [accounts],
  );
}

const sameTag = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export interface AccountTagsValue {
  shop: ShopTier;
  monetized: boolean;
  tags: string[];
}

interface AccountTagsFieldProps {
  platform: Platform;
  value: AccountTagsValue;
  error?: string;
  onChange: (next: Partial<AccountTagsValue>) => void;
}

/**
 * Tags da conta num lugar só. Shop piloto, Shop ativo e Monetizada são fixas (vêm dos dados da conta);
 * as outras o Jota cria e reaproveita.
 */
export function AccountTagsField({ platform, value, error, onChange }: AccountTagsFieldProps) {
  const created = useCreatedTags();
  const colors = useAdminTagColors();
  // Criada nesta ficha e desmarcada antes de salvar: continua na lista até sair da página.
  const [drafted, setDrafted] = useState<string[]>([]);
  const options = normalizeAccountTags([...created, ...drafted, ...value.tags]).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const full = value.tags.length >= MAX_ACCOUNT_TAGS;
  const isSelected = (tag: string) => value.tags.some((current) => sameTag(current, tag));

  const toggle = (tag: string) =>
    onChange({ tags: isSelected(tag) ? value.tags.filter((current) => !sameTag(current, tag)) : normalizeAccountTags([...value.tags, tag]) });

  const create = (tag: string) => {
    setDrafted((current) => normalizeAccountTags([...current, tag]));
    if (!isSelected(tag)) onChange({ tags: normalizeAccountTags([...value.tags, tag]) });
  };

  const monetizedLabel = platform === "youtube" ? "Monetizado" : "Monetizada";
  const colorable: ColorableTag[] = [
    ...(platform === "tiktok"
      ? [
          { key: SHOP_TAG_KEY.pilot, label: "Shop piloto" },
          { key: SHOP_TAG_KEY.full, label: "Shop ativo" },
        ]
      : []),
    { key: MONETIZED_TAG_KEY, label: monetizedLabel },
    ...options.map((tag) => ({ key: customTagKey(tag), label: tag })),
  ];

  return (
    <fieldset>
      <legend className="text-sm font-medium text-fog">Tags da conta</legend>
      <ul className="mt-3 flex flex-wrap gap-2">
        {platform === "tiktok" && (
          <>
            <li>
              <TagChip label="Shop piloto" tone="pink" color={colors[SHOP_TAG_KEY.pilot]} selected={value.shop === "pilot"} onToggle={() => onChange({ shop: value.shop === "pilot" ? "none" : "pilot" })} />
            </li>
            <li>
              <TagChip label="Shop ativo" tone="electric" color={colors[SHOP_TAG_KEY.full]} selected={value.shop === "full"} onToggle={() => onChange({ shop: value.shop === "full" ? "none" : "full" })} />
            </li>
          </>
        )}
        <li>
          <TagChip label={monetizedLabel} tone="emerald" color={colors[MONETIZED_TAG_KEY]} selected={value.monetized} onToggle={() => onChange({ monetized: !value.monetized })} />
        </li>
        {options.map((tag) => (
          <li key={tag.toLowerCase()}>
            <TagChip label={tag} tone="custom" color={colors[customTagKey(tag)]} selected={isSelected(tag)} disabled={full && !isSelected(tag)} onToggle={() => toggle(tag)} />
          </li>
        ))}
        <li>
          <CreateTag onCreate={create} disabled={full} />
        </li>
      </ul>
      <p className={cn("mt-2 text-xs", error ? "font-medium text-[#ff7a7a]" : "text-mist")}>
        {error ??
          (full
            ? `Limite de ${MAX_ACCOUNT_TAGS} tags criadas por conta. Desmarque uma para marcar outra.`
            : "Clique para marcar ou desmarcar. Tags criadas aqui ficam disponíveis para as outras contas.")}
      </p>
      {drafted.length > 0 && (
        <p role="status" className="mt-2 text-xs font-medium text-electric-soft">
          Tag criada. Para gravar nesta conta, clique em Salvar no fim da ficha.
        </p>
      )}
      <TagColorPicker tags={colorable} />
    </fieldset>
  );
}
