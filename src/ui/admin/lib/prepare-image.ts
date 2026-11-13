import type { PreparedImage } from "@/application/ports";

const MAX_INPUT_BYTES = 15 * 1024 * 1024;
const MAX_WIDTH = 1080;
const MAX_HEIGHT = 1920;
const AVATAR_SIZE = 512;
const QUALITY = 0.85;

export class ImageInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageInputError";
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));
}

async function openImage(file: File): Promise<ImageBitmap> {
  if (!file.type.startsWith("image/")) throw new ImageInputError("Escolha um arquivo de imagem (PNG, JPG ou WebP).");
  if (file.size > MAX_INPUT_BYTES) throw new ImageInputError("A imagem passa de 15 MB. Use um print menor.");
  try {
    return await createImageBitmap(file);
  } catch {
    throw new ImageInputError("Não foi possível abrir essa imagem. Tente outro arquivo.");
  }
}

/** Recorte da imagem de origem (sx, sy, sw, sh) desenhado no tamanho final (width x height). */
interface Crop {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  width: number;
  height: number;
}

async function render(bitmap: ImageBitmap, { sx, sy, sw, sh, width, height }: Crop): Promise<PreparedImage> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new ImageInputError("Seu navegador não conseguiu processar a imagem.");
  context.drawImage(bitmap, sx, sy, sw, sh, 0, 0, width, height);
  bitmap.close();

  const webp = await canvasToBlob(canvas, "image/webp");
  const blob = webp?.type === "image/webp" ? webp : await canvasToBlob(canvas, "image/jpeg");
  if (!blob) throw new ImageInputError("Não foi possível converter a imagem.");
  return { blob, width, height };
}

/**
 * Print de celular costuma ter 3 a 5 MB. Aqui ele é reduzido para no máximo 1080x1920 e convertido
 * para WebP (JPEG nos navegadores sem suporte), o que deixa o site leve sem perder leitura.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const bitmap = await openImage(file);
  const scale = Math.min(1, MAX_WIDTH / bitmap.width, MAX_HEIGHT / bitmap.height);
  return render(bitmap, {
    sx: 0,
    sy: 0,
    sw: bitmap.width,
    sh: bitmap.height,
    width: Math.round(bitmap.width * scale),
    height: Math.round(bitmap.height * scale),
  });
}

/** Foto de perfil: recorte quadrado do centro, em até 512x512, que é o que o círculo do painel mostra. */
export async function prepareAvatar(file: File): Promise<PreparedImage> {
  const bitmap = await openImage(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const size = Math.min(AVATAR_SIZE, side);
  return render(bitmap, {
    sx: Math.round((bitmap.width - side) / 2),
    sy: Math.round((bitmap.height - side) / 2),
    sw: side,
    sh: side,
    width: size,
    height: size,
  });
}
