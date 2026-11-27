import { Smile, Sticker as StickerIcon } from "lucide-react";
import { useId, useState } from "react";
import { STICKERS, stickerImageOf, type Sticker } from "@/domain/sticker";
import { cn } from "@/ui/lib/cn";

const EMOJIS = [
  "😀", "😂", "🤣", "😅", "😊", "😍", "🥰", "😘", "😉", "😎", "🤩", "🥳",
  "🤔", "🤨", "😐", "🙄", "😏", "😴", "🤯", "😱", "😭", "😢", "😡", "🤬",
  "🤡", "💀", "👻", "🫠", "🥲", "🤗", "🤫", "🤭", "🙃", "😬", "🥺", "😤",
  "👍", "👎", "👏", "🙌", "🙏", "💪", "🤝", "👀", "👌", "✌️", "🤞", "👋",
  "❤️", "💙", "💜", "🖤", "💔", "🔥", "✨", "⭐", "🎉", "💯", "✅", "❌",
  "⚠️", "❓", "💡", "📌", "📱", "💻", "📸", "🎥", "💰", "🤑", "🚀", "⏰",
] as const;

type Panel = "emoji" | "sticker" | null;

interface ConversationExtrasProps {
  /** Emoji entra no texto onde está o cursor. */
  onEmoji: (emoji: string) => void;
  /** Figurinha é enviada na hora, como mensagem própria. */
  onSticker: (sticker: Sticker) => void;
  disabled?: boolean;
  className?: string;
}

const toggleClass = (active: boolean) =>
  cn(
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-electric disabled:opacity-50",
    active ? "border-electric/50 bg-electric/15 text-white" : "border-line-strong text-fog hover:text-white",
  );

/** Botões de emoji e figurinha da conversa (Suporte e chat). Os painéis abrem logo abaixo, dentro do formulário. */
export function ConversationExtras({ onEmoji, onSticker, disabled, className }: ConversationExtrasProps) {
  const [panel, setPanel] = useState<Panel>(null);
  const panelId = useId();
  const toggle = (next: Exclude<Panel, null>) => setPanel((current) => (current === next ? null : next));

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-expanded={panel === "emoji"}
          aria-controls={panelId}
          disabled={disabled}
          onClick={() => toggle("emoji")}
          className={toggleClass(panel === "emoji")}
        >
          <Smile aria-hidden className="size-4" /> Emoji
        </button>
        <button
          type="button"
          aria-expanded={panel === "sticker"}
          aria-controls={panelId}
          disabled={disabled}
          onClick={() => toggle("sticker")}
          className={toggleClass(panel === "sticker")}
        >
          <StickerIcon aria-hidden className="size-4" /> Figurinha
        </button>
      </div>
      <div id={panelId}>
        {panel === "emoji" && (
          <div role="group" aria-label="Emojis" className="mt-2 grid max-h-56 grid-cols-8 gap-1 overflow-y-auto rounded-2xl border border-line-strong bg-ink p-2 sm:grid-cols-12">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onEmoji(emoji)}
                aria-label={`Inserir ${emoji}`}
                className="grid aspect-square place-items-center rounded-lg text-xl transition-colors hover:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-electric"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        {panel === "sticker" && (
          <div role="group" aria-label="Figurinhas" className="mt-2 grid max-h-72 grid-cols-4 gap-2 overflow-y-auto rounded-2xl border border-line-strong bg-ink p-2 sm:grid-cols-6">
            {STICKERS.map((sticker) => (
              <button
                key={sticker.id}
                type="button"
                disabled={disabled}
                onClick={() => {
                  setPanel(null);
                  onSticker(sticker);
                }}
                aria-label={`Enviar figurinha: ${sticker.label}`}
                title={sticker.label}
                className="grid aspect-square place-items-center rounded-xl p-1 transition-colors hover:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-electric disabled:opacity-50"
              >
                <img src={stickerImageOf(sticker)} alt="" loading="lazy" className="size-full object-contain" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Figurinha dentro da conversa, no lugar do texto. */
export function StickerImage({ sticker, className }: { sticker: Sticker; className?: string }) {
  return <img src={stickerImageOf(sticker)} alt={`Figurinha: ${sticker.label}`} loading="lazy" className={cn("size-28 object-contain sm:size-32", className)} />;
}
