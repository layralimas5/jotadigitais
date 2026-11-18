import { useEffect, useState } from "react";

const SAMPLE_WIDTH = 24;
const SAMPLE_ROWS = 16;
/** Faixa de baixo do print que entra na conta: uma linha só pega barra de navegação ou borda clara. */
const BOTTOM_SHARE = 0.15;

/** Cor que mais aparece no fim da imagem, em `rgb(...)`: a mediana de cada canal ignora ícones e bordas soltas. */
function bottomColor(image: HTMLImageElement): string | null {
  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE_WIDTH;
  canvas.height = SAMPLE_ROWS;
  const context = canvas.getContext("2d");
  if (!context) return null;
  const bandHeight = Math.max(1, Math.round(image.naturalHeight * BOTTOM_SHARE));
  context.drawImage(image, 0, image.naturalHeight - bandHeight, image.naturalWidth, bandHeight, 0, 0, SAMPLE_WIDTH, SAMPLE_ROWS);
  const { data } = context.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_ROWS);
  const pixels = SAMPLE_WIDTH * SAMPLE_ROWS;
  const median = (offset: number) => {
    const values = Array.from({ length: pixels }, (_, index) => data[index * 4 + offset] ?? 0).sort((a, b) => a - b);
    return values[Math.floor(pixels / 2)] ?? 0;
  };
  return `rgb(${median(0)}, ${median(1)}, ${median(2)})`;
}

/**
 * Cor do fim do print, para preencher a tela do celular quando o print é mais curto que ela.
 * Nula enquanto carrega ou se o servidor da imagem não liberar a leitura (aí fica o fundo padrão).
 */
export function useImageBottomColor(src: string): string | null {
  const [color, setColor] = useState<{ src: string; value: string | null } | null>(null);

  useEffect(() => {
    let active = true;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => {
      let value: string | null = null;
      try {
        value = bottomColor(image);
      } catch (error) {
        console.warn("Cor do fim do print não pôde ser lida", error);
      }
      if (active) setColor({ src, value });
    };
    image.onerror = () => active && setColor({ src, value: null });
    image.src = src;
    return () => {
      active = false;
    };
  }, [src]);

  return color?.src === src ? color.value : null;
}
