/** Códigos ISO com bandeira em `public/flags` (SVG 3x2 do pacote country-flag-icons). */
const FLAG_CODES: ReadonlySet<string> = new Set([
  "AC", "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX", "AZ", "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS", "BT", "BV", "BW", "BY", "BZ", "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN", "CO", "CR", "CU", "CV", "CW", "CX", "CY", "CZ", "DE", "DJ", "DK", "DM", "DO", "DZ", "EC", "EE", "EG", "EH", "ER", "ES", "ET", "EU", "FI", "FJ", "FK", "FM", "FO", "FR", "GA", "GB", "GD", "GE", "GF", "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS", "GT", "GU", "GW", "GY", "HK", "HM", "HN", "HR", "HT", "HU", "IC", "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR", "IS", "IT", "JE", "JM", "JO", "JP", "KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KY", "KZ", "LA", "LB", "LC", "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK", "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY", "MZ", "NA", "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ", "OM", "PA", "PE", "PF", "PG", "PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PW", "PY", "QA", "RE", "RO", "RS", "RU", "RW", "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS", "ST", "SV", "SX", "SY", "SZ", "TA", "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO", "TR", "TT", "TV", "TW", "TZ", "UA", "UG", "UM", "US", "UY", "UZ", "VA", "VC", "VE", "VG", "VI", "VN", "VU", "WF", "WS", "XA", "XC", "XK", "XO", "YE", "YT", "ZA", "ZM", "ZW",
]);

const ISO_CODE = /^[A-Z]{2}$/;

const normalize = (text: string): string =>
  text.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();

let codeByName: Map<string, string> | undefined;

/** Nome em português de cada bandeira, para achar o ISO dos países criados no painel (código = nome). */
function isoByName(name: string): string | undefined {
  if (!codeByName) {
    const names = new Intl.DisplayNames(["pt-BR"], { type: "region" });
    codeByName = new Map();
    for (const code of FLAG_CODES) {
      const label = names.of(code);
      if (label && label !== code) codeByName.set(normalize(label), code);
    }
  }
  return codeByName.get(normalize(name));
}

/** Caminho da bandeira do país, ou `undefined` quando não há bandeira conhecida (aí a UI mostra o globo). */
export function countryFlagSrc(code: string, name: string): string | undefined {
  const iso = ISO_CODE.test(code) && FLAG_CODES.has(code) ? code : isoByName(name);
  return iso ? `${import.meta.env.BASE_URL}flags/${iso}.svg` : undefined;
}
