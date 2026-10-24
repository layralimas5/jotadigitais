import type { Cents } from "./money";

/**
 * Código Pix "copia e cola" (BR Code estático com valor), o mesmo que o app do banco gera em "Cobrar".
 * O Nubank PJ não tem API de cobrança: o código leva a chave do Jota, o valor e o número do pedido,
 * e o recebimento é confirmado por ele no painel.
 * Padrão: Manual de Padrões para Iniciação do Pix (BCB), campos EMV-MPM.
 */
export interface PixCharge {
  key: string;
  /** Nome de quem recebe, até 25 caracteres. */
  receiverName: string;
  /** Cidade de quem recebe, até 15 caracteres. */
  receiverCity: string;
  amount: Cents;
  /** Identificador que aparece no extrato: o código do pedido. Até 25 letras e números. */
  txid: string;
}

const field = (id: string, value: string) => `${id}${String(value.length).padStart(2, "0")}${value}`;

/** Nome e cidade vão sem acento e em maiúsculas: muitos apps recusam outros caracteres. */
const plain = (value: string, max: number) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .trim()
    .toUpperCase()
    .slice(0, max);

/** CRC16-CCITT (polinômio 0x1021, início 0xFFFF), exigido no fim do BR Code. */
export function crc16(payload: string): string {
  let crc = 0xffff;
  for (const char of payload) {
    crc ^= char.charCodeAt(0) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function buildPixCode(charge: PixCharge): string {
  const account = field("00", "br.gov.bcb.pix") + field("01", charge.key.trim());
  const txid = charge.txid.replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";
  const payload =
    field("00", "01") +
    field("26", account) +
    field("52", "0000") +
    field("53", "986") +
    field("54", (charge.amount / 100).toFixed(2)) +
    field("58", "BR") +
    field("59", plain(charge.receiverName, 25)) +
    field("60", plain(charge.receiverCity, 15)) +
    field("62", field("05", txid)) +
    "6304";
  return payload + crc16(payload);
}
