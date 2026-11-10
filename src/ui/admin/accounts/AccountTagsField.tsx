import { Plus, X } from "lucide-react";
import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { listAllAccounts } from "@/application/admin-use-cases";
import { MAX_ACCOUNT_TAG_LENGTH, MAX_ACCOUNT_TAGS, normalizeAccountTags } from "@/domain/account";
import { cn } from "@/ui/lib/cn";
import { useAdminQuery } from "../hooks";

interface AccountTagsFieldProps {
  tags: string[];
  error?: string;
  onChange: (tags: string[]) => void;
}

const sameTag = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Etiquetas já usadas em outras contas, para o Jota criar uma vez e reaproveitar. */
function useKnownTags(): string[] {
  const accounts = useAdminQuery(listAllAccounts, "account-tags");
  return useMemo(
    () => (accounts.status === "success" ? normalizeAccountTags(accounts.data.flatMap((account) => account.tags)).sort((a, b) => a.localeCompare(b, "pt-BR")) : []),
    [accounts],
  );
}

export function AccountTagsField({ tags, error, onChange }: AccountTagsFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const known = useKnownTags();
  const full = tags.length >= MAX_ACCOUNT_TAGS;
  const suggestions = known.filter((tag) => !tags.some((current) => sameTag(current, tag)));

  const add = (text: string) => {
    const tag = text.trim().replace(/\s+/g, " ").slice(0, MAX_ACCOUNT_TAG_LENGTH);
    if (!tag || full) return;
    onChange(normalizeAccountTags([...tags, tag]));
    setDraft("");
  };

  const remove = (tag: string) => onChange(tags.filter((current) => current !== tag));

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add(draft);
    } else if (event.key === "Backspace" && !draft && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const hint = full
    ? `Limite de ${MAX_ACCOUNT_TAGS} etiquetas. Tire uma para colocar outra.`
    : `Escreva e aperte Enter. Até ${MAX_ACCOUNT_TAGS} etiquetas de ${MAX_ACCOUNT_TAG_LENGTH} letras.`;

  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-fog">
        Etiquetas
      </label>
      <div
        className={cn(
          "mt-2 flex min-h-12 flex-wrap items-center gap-1.5 rounded-xl border bg-ink px-2 py-2 transition-colors focus-within:border-electric",
          error ? "border-alert/70" : "border-line-strong",
        )}
      >
        {tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.05] py-1 pr-1 pl-2.5 text-xs font-semibold text-fog">
            {tag}
            <button
              type="button"
              onClick={() => remove(tag)}
              aria-label={`Tirar a etiqueta ${tag}`}
              className="grid size-5 place-items-center rounded-full text-mist hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-electric"
            >
              <X aria-hidden className="size-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          name="tags"
          value={draft}
          disabled={full}
          maxLength={MAX_ACCOUNT_TAG_LENGTH}
          autoComplete="off"
          placeholder={tags.length === 0 ? "Ex.: Nicho quente" : full ? "" : "Mais uma…"}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-hint`}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => add(draft)}
          className="h-8 min-w-[8rem] flex-1 bg-transparent px-2 text-sm text-white placeholder:text-mist/70 focus:outline-none disabled:cursor-not-allowed"
        />
      </div>
      <p id={`${id}-hint`} className={cn("mt-1.5 text-xs", error ? "font-medium text-[#ff7a7a]" : "text-mist")}>
        {error ?? hint}
      </p>
      {suggestions.length > 0 && !full && (
        <div className="mt-3">
          <p className="text-xs text-mist">Já usadas em outras contas:</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {suggestions.map((tag) => (
              <li key={tag}>
                <button
                  type="button"
                  onClick={() => add(tag)}
                  className="inline-flex items-center gap-1 rounded-full border border-dashed border-line-strong px-2.5 py-1 text-xs text-fog hover:border-electric hover:text-white focus-visible:outline-2 focus-visible:outline-electric"
                >
                  <Plus aria-hidden className="size-3" />
                  {tag}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
