// Sem letras e números que se confundem (l, I, 1, O, 0) para dar para digitar olhando no celular.
const LETTERS = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%&*?";
const ALL = LETTERS + DIGITS + SYMBOLS;

function randomIndex(max: number): number {
  // Descarta o resto que deixaria alguns caracteres mais prováveis que outros.
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const buffer = new Uint32Array(1);
  do crypto.getRandomValues(buffer);
  while (buffer[0]! >= limit);
  return buffer[0]! % max;
}

const pick = (alphabet: string) => alphabet[randomIndex(alphabet.length)]!;

/** Senha forte e aleatória, com pelo menos uma letra, um número e um símbolo (regra comum das redes). */
export function generatePassword(length = 16): string {
  const chars = [pick(LETTERS), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < length) chars.push(pick(ALL));
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join("");
}
