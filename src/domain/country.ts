/** Países em que a conta pode ter sido criada. Mesma lista da checagem `accounts_country` no banco. */
export const ACCOUNT_COUNTRIES = [
  "BR",
  "US",
  "PT",
  "AR",
  "MX",
  "CO",
  "CL",
  "PE",
  "PY",
  "UY",
  "ES",
  "GB",
  "CA",
  "DE",
  "FR",
  "IT",
  "AU",
  "JP",
  "AO",
  "MZ",
] as const;

export type CountryCode = (typeof ACCOUNT_COUNTRIES)[number];

export const DEFAULT_COUNTRY: CountryCode = "BR";

export const COUNTRY_LABEL: Record<CountryCode, string> = {
  BR: "Brasil",
  US: "Estados Unidos",
  PT: "Portugal",
  AR: "Argentina",
  MX: "México",
  CO: "Colômbia",
  CL: "Chile",
  PE: "Peru",
  PY: "Paraguai",
  UY: "Uruguai",
  ES: "Espanha",
  GB: "Reino Unido",
  CA: "Canadá",
  DE: "Alemanha",
  FR: "França",
  IT: "Itália",
  AU: "Austrália",
  JP: "Japão",
  AO: "Angola",
  MZ: "Moçambique",
};

export const isCountryCode = (value: unknown): value is CountryCode =>
  typeof value === "string" && (ACCOUNT_COUNTRIES as readonly string[]).includes(value);

/** Nome do país; contas antigas (sem país gravado) contam como Brasil. */
export const countryLabelOf = (code: CountryCode | null | undefined): string => COUNTRY_LABEL[code ?? DEFAULT_COUNTRY];
