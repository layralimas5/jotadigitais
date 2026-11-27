/**
 * Figurinhas das conversas (Suporte e chat): emojis animados do Noto (Google, licença CC BY 4.0),
 * guardados em /public/stickers. A ordem é a do painel de escolha.
 */
export const STICKERS = [
  { id: "poop", emoji: "💩", label: "Cocô" },
  { id: "laugh", emoji: "😂", label: "Rindo" },
  { id: "rofl", emoji: "🤣", label: "Rolando de rir" },
  { id: "sob", emoji: "😭", label: "Chorando" },
  { id: "skull", emoji: "💀", label: "Morri" },
  { id: "clown", emoji: "🤡", label: "Palhaço" },
  { id: "pray", emoji: "🙏", label: "Por favor" },
  { id: "fire", emoji: "🔥", label: "Fogo" },
  { id: "heart", emoji: "❤️", label: "Coração" },
  { id: "party", emoji: "🥳", label: "Festa" },
  { id: "thumbs-up", emoji: "👍", label: "Joinha" },
  { id: "clap", emoji: "👏", label: "Palmas" },
  { id: "eyes", emoji: "👀", label: "De olho" },
  { id: "thinking", emoji: "🤔", label: "Pensando" },
  { id: "money", emoji: "🤑", label: "Dinheiro" },
  { id: "rocket", emoji: "🚀", label: "Foguete" },
  { id: "angry", emoji: "😡", label: "Bravo" },
  { id: "rage", emoji: "🤬", label: "Xingando" },
  { id: "cool", emoji: "😎", label: "De boa" },
  { id: "mind-blown", emoji: "🤯", label: "Explodiu a cabeça" },
  { id: "hug", emoji: "🤗", label: "Abraço" },
  { id: "melting", emoji: "🫠", label: "Derretendo" },
  { id: "wink", emoji: "😉", label: "Piscadinha" },
] as const;

export type Sticker = (typeof STICKERS)[number];
export type StickerId = Sticker["id"];

export const STICKER_IDS = STICKERS.map((sticker) => sticker.id) as [StickerId, ...StickerId[]];

export const stickerOf = (id: string | null | undefined): Sticker | null => STICKERS.find((sticker) => sticker.id === id) ?? null;

export const stickerImageOf = (sticker: Sticker): string => `/stickers/${sticker.id}.webp`;

/** Texto da mensagem com figurinha: é o que aparece no sininho, no celular e no resumo da última mensagem. */
export const stickerMessageBody = (sticker: Sticker): string => `Figurinha ${sticker.emoji}`;
