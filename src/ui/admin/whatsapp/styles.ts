/** Botões compactos da caixa de entrada e dos fluxos: retangulares e sem brilho, para a tela parecer ferramenta de trabalho. */
const compactBase =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric disabled:pointer-events-none disabled:opacity-50";

export const compactButton = {
  primary: `${compactBase} px-3 bg-white text-ink hover:bg-fog`,
  secondary: `${compactBase} px-3 border border-line-strong text-fog hover:border-white/25 hover:text-white`,
  icon: `${compactBase} w-8 text-mist hover:bg-white/[0.06] hover:text-white`,
} as const;
